// ============================================
// VPP Simulation Game - Asset Physics Models
// Implements state update logic per asset type
// ============================================

import {
  Asset,
  HvacResi,
  BatteryResi,
  EvResi,
  FleetSite,
  CiBuilding,
  HvacCommand,
  BatteryCommand,
  EvCommand,
  FleetCommand,
  CiBuildingCommand,
  AssetCommand,
  ScenarioConfig,
} from './types';

const TIMESTEP_MINUTES = 5;
const TIMESTEP_HOURS = TIMESTEP_MINUTES / 60;

// ---------- Helper Functions ----------

function applyMeasurementNoise(value: number, noisePct: number): number {
  const noise = 1 + (Math.random() * 2 - 1) * noisePct;
  return value * noise;
}

function updateBaselineDrift(
  currentDrift: number,
  rho: number,
  sigmaDrift: number
): number {
  // AR(1) process: drift(t+1) = rho * drift(t) + noise
  const innovation = (Math.random() * 2 - 1) * sigmaDrift;
  return rho * currentDrift + innovation;
}

function rollNoncompliance(probability: number): boolean {
  return Math.random() < probability;
}

// ---------- HVAC Residential Model ----------

export function updateHvacResi(
  asset: HvacResi,
  command: HvacCommand | null,
  outdoorTemp: number,
  config: ScenarioConfig
): { asset: HvacResi; powerDelta: number } {
  const state = { ...asset.state };
  const params = asset.params;

  // Check if dropped
  if (state.dropped) {
    return { asset: { ...asset, state }, powerDelta: 0 };
  }

  // Apply command (setpoint shift)
  if (command && !rollNoncompliance(config.noncompliance.probability)) {
    state.setpoint_f = params.pref_setpoint_f + command.delta_setpoint_f;
  }

  // Thermal model: Tin(t+1) = Tin(t) + α(Tout - Tin) + β·HVAC_on
  const leakage = params.alpha * (outdoorTemp - state.tin_f);
  const hvacEffect = state.hvac_on ? params.beta : 0;
  state.tin_f = state.tin_f + leakage + hvacEffect;

  // Thermostat logic with deadband
  const isCooling = params.mode === 'cooling';
  if (isCooling) {
    if (state.tin_f > state.setpoint_f + params.deadband_f) {
      state.hvac_on = true;
    } else if (state.tin_f < state.setpoint_f - params.deadband_f) {
      state.hvac_on = false;
    }
  } else {
    // Heating
    if (state.tin_f < state.setpoint_f - params.deadband_f) {
      state.hvac_on = true;
    } else if (state.tin_f > state.setpoint_f + params.deadband_f) {
      state.hvac_on = false;
    }
  }

  // Check comfort violation -> drop-off
  if (isCooling && state.tin_f > params.comfort_max_f) {
    state.dropped = true;
  } else if (!isCooling && state.tin_f < params.comfort_min_f) {
    state.dropped = true;
  }

  // Update baseline drift
  state.baseline_drift = updateBaselineDrift(
    state.baseline_drift,
    config.baseline_error.rho,
    config.baseline_error.sigma_drift
  );

  // Calculate power delta (reduction from baseline)
  // Baseline = HVAC running at normal setpoint
  // If HVAC is off due to shifted setpoint, that's load reduction
  const baselineOn = true; // Assume baseline is HVAC running
  const actualPower = state.hvac_on ? params.hvac_kw : 0;
  const baselinePower = baselineOn ? params.hvac_kw : 0;
  const baselineAdjusted = baselinePower * (1 + state.baseline_bias + state.baseline_drift);
  let powerDelta = baselineAdjusted - actualPower;
  powerDelta = applyMeasurementNoise(powerDelta, config.measurement_noise.pct_uniform);

  return { asset: { ...asset, state }, powerDelta: Math.max(0, powerDelta) };
}

// ---------- Battery Residential Model ----------

export function updateBatteryResi(
  asset: BatteryResi,
  command: BatteryCommand | null,
  config: ScenarioConfig
): { asset: BatteryResi; powerDelta: number } {
  const state = { ...asset.state };
  const params = asset.params;

  if (state.dropped) {
    return { asset: { ...asset, state }, powerDelta: 0 };
  }

  let powerOutput = 0;

  if (command && !rollNoncompliance(config.noncompliance.probability)) {
    // Positive = discharge, negative = charge
    const requestedPower = command.power_kw;

    if (requestedPower > 0) {
      // Discharge
      const maxDischarge = Math.min(
        params.p_dis_kw,
        (state.soc - params.soc_reserve) * params.e_kwh / TIMESTEP_HOURS
      );
      powerOutput = Math.min(requestedPower, Math.max(0, maxDischarge));
      state.soc -= (powerOutput * TIMESTEP_HOURS) / params.e_kwh;
    } else if (requestedPower < 0) {
      // Charge
      const maxCharge = Math.min(
        params.p_ch_kw,
        (1 - state.soc) * params.e_kwh / TIMESTEP_HOURS
      );
      const chargeRate = Math.min(-requestedPower, maxCharge);
      state.soc += (chargeRate * TIMESTEP_HOURS) / params.e_kwh;
      powerOutput = -chargeRate;
    }
  }

  // Update baseline drift
  state.baseline_drift = updateBaselineDrift(
    state.baseline_drift,
    config.baseline_error.rho,
    config.baseline_error.sigma_drift
  );

  // Power delta = discharge power (grid load reduction)
  // Baseline is 0 (battery normally idle), so discharge = positive delta
  let powerDelta = powerOutput > 0 ? powerOutput : 0;
  powerDelta = applyMeasurementNoise(powerDelta, config.measurement_noise.pct_uniform);

  return { asset: { ...asset, state }, powerDelta };
}

// ---------- EV Residential Model ----------

export function updateEvResi(
  asset: EvResi,
  command: EvCommand | null,
  currentTimestep: number,
  config: ScenarioConfig
): { asset: EvResi; powerDelta: number } {
  const state = { ...asset.state };
  const params = asset.params;

  if (state.dropped) {
    return { asset: { ...asset, state }, powerDelta: 0 };
  }

  // Handle arrival/departure
  if (currentTimestep >= params.t_arrival && !state.plugged) {
    state.plugged = true;
  }
  if (currentTimestep >= params.t_depart) {
    state.plugged = false;
    state.dropped = true;
    return { asset: { ...asset, state }, powerDelta: 0 };
  }

  if (!state.plugged) {
    return { asset: { ...asset, state }, powerDelta: 0 };
  }

  // Check deadline constraint
  const remainingSteps = params.t_depart - currentTimestep;
  const remainingEnergy = params.e_req_kwh - state.e_kwh;
  const maxPossibleEnergy = params.p_max_kw * remainingSteps * TIMESTEP_HOURS;

  if (remainingEnergy > 0 && maxPossibleEnergy <= remainingEnergy * 1.1) {
    // Deadline pressure -> override mode
    state.override_active = true;
  }

  let chargePower = params.p_max_kw; // Default baseline charge rate

  if (state.override_active) {
    // Must charge at max rate
    chargePower = params.p_max_kw;
  } else if (command && !rollNoncompliance(config.noncompliance.probability)) {
    // Apply commanded charging rate
    chargePower = Math.max(0, Math.min(command.power_kw, params.p_max_kw));
  }

  // Update battery
  const chargeEnergy = chargePower * TIMESTEP_HOURS;
  state.e_kwh = Math.min(state.e_kwh + chargeEnergy, params.e_capacity_kwh);

  // Update baseline drift
  state.baseline_drift = updateBaselineDrift(
    state.baseline_drift,
    config.baseline_error.rho,
    config.baseline_error.sigma_drift
  );

  // Power delta = baseline - actual
  // Baseline = charging at max rate
  const baselinePower = params.p_max_kw * (1 + state.baseline_bias + state.baseline_drift);
  let powerDelta = baselinePower - chargePower;
  powerDelta = applyMeasurementNoise(powerDelta, config.measurement_noise.pct_uniform);

  return { asset: { ...asset, state }, powerDelta: Math.max(0, powerDelta) };
}

// ---------- Fleet Site Model ----------

export function updateFleetSite(
  asset: FleetSite,
  command: FleetCommand | null,
  currentTimestep: number,
  config: ScenarioConfig
): { asset: FleetSite; powerDelta: number } {
  const state = { ...asset.state };
  const params = asset.params;

  if (state.dropped) {
    return { asset: { ...asset, state }, powerDelta: 0 };
  }

  // Update vehicle plug status
  for (const vehicle of params.vehicles) {
    const vState = state.vehicle_state[vehicle.id];
    if (currentTimestep >= vehicle.t_arrival && !vState.plugged) {
      vState.plugged = true;
    }
    if (currentTimestep >= vehicle.t_depart) {
      vState.plugged = false;
    }
  }

  // Determine site power cap
  let sitePowerCap = params.u_site_max_kw; // Default max
  if (command && !rollNoncompliance(config.noncompliance.probability)) {
    sitePowerCap = Math.max(0, Math.min(command.site_power_cap_kw, params.u_site_max_kw));
  }

  // Calculate urgency-based allocation
  const pluggedVehicles = params.vehicles.filter(v => {
    const vs = state.vehicle_state[v.id];
    return vs.plugged && vs.e_kwh < v.e_req_kwh && currentTimestep < v.t_depart;
  });

  let totalUrgency = 0;
  const urgencies: Record<string, number> = {};

  for (const v of pluggedVehicles) {
    const vs = state.vehicle_state[v.id];
    const remainingEnergy = v.e_req_kwh - vs.e_kwh;
    const remainingTime = Math.max(1, v.t_depart - currentTimestep) * TIMESTEP_HOURS;
    const urgency = remainingEnergy / remainingTime;
    urgencies[v.id] = urgency;
    totalUrgency += urgency;
  }

  // Allocate power proportionally
  let actualSitePower = 0;
  for (const v of pluggedVehicles) {
    const vs = state.vehicle_state[v.id];
    const proportion = totalUrgency > 0 ? urgencies[v.id] / totalUrgency : 1 / pluggedVehicles.length;
    const allocatedPower = Math.min(v.p_max_kw, proportion * sitePowerCap);
    const chargeEnergy = allocatedPower * TIMESTEP_HOURS;
    vs.e_kwh = Math.min(vs.e_kwh + chargeEnergy, v.e_capacity_kwh);
    actualSitePower += allocatedPower;
  }

  // Update baseline drift
  state.baseline_drift = updateBaselineDrift(
    state.baseline_drift,
    config.baseline_error.rho,
    config.baseline_error.sigma_drift
  );

  // Power delta
  const baselinePower = params.u_site_max_kw * 0.7 * (1 + state.baseline_bias + state.baseline_drift);
  let powerDelta = baselinePower - actualSitePower;
  powerDelta = applyMeasurementNoise(powerDelta, config.measurement_noise.pct_uniform);

  return { asset: { ...asset, state }, powerDelta: Math.max(0, powerDelta) };
}

// ---------- C&I Building Model ----------

export function updateCiBuilding(
  asset: CiBuilding,
  command: CiBuildingCommand | null,
  currentTimestep: number,
  startHour: number,
  config: ScenarioConfig
): { asset: CiBuilding; powerDelta: number } {
  const state = { ...asset.state };
  const params = asset.params;

  if (state.dropped) {
    return { asset: { ...asset, state }, powerDelta: 0 };
  }

  const currentHour = (startHour + currentTimestep * (TIMESTEP_MINUTES / 60)) % 24;
  const isBusinessHours = currentHour >= params.business_hours.start_hour &&
    currentHour < params.business_hours.end_hour;

  // Default to no shed, process on
  let targetHvacShed = 0;
  let targetProcessOn = state.process_on;

  if (command && !rollNoncompliance(config.noncompliance.probability)) {
    targetHvacShed = command.hvac_shed_kw;
    targetProcessOn = command.process_on;
  }

  // HVAC shed with fatigue
  // Available capacity: Savail = Smax * exp(-k * fatigue)
  const availableCapacity = params.smax_hvac_kw * Math.exp(-params.fatigue_k * state.fatigue);
  const actualShed = Math.min(targetHvacShed, availableCapacity);
  state.hvac_shed_kw = actualShed;

  // Update fatigue
  // f(t+1) = max(0, f(t) + a*(shed/Smax) - b*(1 - shed/Smax))
  const shedRatio = actualShed / params.smax_hvac_kw;
  state.fatigue = Math.max(
    0,
    state.fatigue + params.fatigue_a * shedRatio - params.fatigue_b * (1 - shedRatio)
  );

  // Check for excessive fatigue drop-off
  if (state.fatigue > 2) {
    state.dropped = true;
    return { asset: { ...asset, state }, powerDelta: 0 };
  }

  // Process load curtailment
  let processLoadDelta = 0;
  if (targetProcessOn !== state.process_on) {
    // Attempting toggle
    if (state.process_toggles_used < params.max_process_toggles) {
      // Can toggle only if not in business hours, or if already used one toggle
      if (!isBusinessHours || state.process_toggles_used > 0) {
        state.process_on = targetProcessOn;
        state.process_toggles_used++;
      }
    }
  }

  if (!state.process_on) {
    processLoadDelta = params.process_load_kw;
  }

  // Update baseline drift
  state.baseline_drift = updateBaselineDrift(
    state.baseline_drift,
    config.baseline_error.rho,
    config.baseline_error.sigma_drift
  );

  // Power delta = HVAC shed + process curtailment
  let powerDelta = actualShed + processLoadDelta;
  powerDelta = applyMeasurementNoise(powerDelta, config.measurement_noise.pct_uniform);

  return { asset: { ...asset, state }, powerDelta: Math.max(0, powerDelta) };
}

// ---------- Unified Update Function ----------

export function updateAsset(
  asset: Asset,
  command: AssetCommand | null,
  currentTimestep: number,
  outdoorTemp: number,
  startHour: number,
  config: ScenarioConfig
): { asset: Asset; powerDelta: number } {
  switch (asset.type) {
    case 'hvac_resi':
      return updateHvacResi(asset, command as HvacCommand | null, outdoorTemp, config);
    case 'battery_resi':
      return updateBatteryResi(asset, command as BatteryCommand | null, config);
    case 'ev_resi':
      return updateEvResi(asset, command as EvCommand | null, currentTimestep, config);
    case 'fleet_site':
      return updateFleetSite(asset, command as FleetCommand | null, currentTimestep, config);
    case 'ci_building':
      return updateCiBuilding(asset, command as CiBuildingCommand | null, currentTimestep, startHour, config);
    default:
      return { asset, powerDelta: 0 };
  }
}

// ---------- Get Asset Status for Display ----------

export interface AssetStatus {
  id: string;
  type: string;
  name: string;
  status: 'active' | 'constrained' | 'dropped';
  powerKw: number;
  details: Record<string, string | number | boolean>;
}

export function getAssetStatus(asset: Asset): AssetStatus {
  const base = {
    id: asset.id,
    type: asset.type,
  };

  switch (asset.type) {
    case 'hvac_resi':
      return {
        ...base,
        name: `HVAC ${asset.id}`,
        status: asset.state.dropped ? 'dropped' : 'active',
        powerKw: asset.state.hvac_on ? asset.params.hvac_kw : 0,
        details: {
          'Indoor Temp': `${asset.state.tin_f.toFixed(1)}°F`,
          'Setpoint': `${asset.state.setpoint_f.toFixed(1)}°F`,
          'HVAC On': asset.state.hvac_on,
          'Mode': asset.params.mode,
        },
      };
    case 'battery_resi':
      return {
        ...base,
        name: `Battery ${asset.id}`,
        status: asset.state.dropped ? 'dropped' : 'active',
        powerKw: 0,
        details: {
          'SOC': `${(asset.state.soc * 100).toFixed(0)}%`,
          'Capacity': `${asset.params.e_kwh.toFixed(1)} kWh`,
          'Max Discharge': `${asset.params.p_dis_kw.toFixed(1)} kW`,
        },
      };
    case 'ev_resi':
      return {
        ...base,
        name: `EV ${asset.id}`,
        status: asset.state.dropped ? 'dropped' :
          asset.state.override_active ? 'constrained' : 'active',
        powerKw: asset.state.plugged ? asset.params.p_max_kw : 0,
        details: {
          'Plugged': asset.state.plugged,
          'Energy': `${asset.state.e_kwh.toFixed(1)} kWh`,
          'Required': `${asset.params.e_req_kwh.toFixed(1)} kWh`,
          'Override': asset.state.override_active,
        },
      };
    case 'fleet_site':
      const pluggedCount = Object.values(asset.state.vehicle_state).filter(v => v.plugged).length;
      return {
        ...base,
        name: `Fleet ${asset.id}`,
        status: asset.state.dropped ? 'dropped' : 'active',
        powerKw: asset.params.u_site_max_kw,
        details: {
          'Vehicles': `${pluggedCount}/${asset.params.vehicles.length}`,
          'Max Power': `${asset.params.u_site_max_kw.toFixed(0)} kW`,
        },
      };
    case 'ci_building':
      return {
        ...base,
        name: `C&I ${asset.id}`,
        status: asset.state.dropped ? 'dropped' :
          asset.state.fatigue > 1 ? 'constrained' : 'active',
        powerKw: asset.state.hvac_shed_kw + (asset.state.process_on ? 0 : asset.params.process_load_kw),
        details: {
          'HVAC Shed': `${asset.state.hvac_shed_kw.toFixed(0)} kW`,
          'Fatigue': `${(asset.state.fatigue * 100).toFixed(0)}%`,
          'Process On': asset.state.process_on,
          'Toggles Used': `${asset.state.process_toggles_used}/${asset.params.max_process_toggles}`,
        },
      };
    default: {
      const _exhaustiveCheck: never = asset;
      return {
        ...base,
        name: (_exhaustiveCheck as Asset).id,
        status: 'active' as const,
        powerKw: 0,
        details: {},
      };
    }
  }
}
