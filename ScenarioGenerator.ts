// ============================================
// VPP Simulation Game - Scenario Generator
// Creates random but valid scenarios per schema
// ============================================

import {
  Scenario,
  ScenarioConfig,
  Asset,
  AssetType,
  HvacResi,
  BatteryResi,
  EvResi,
  FleetSite,
  CiBuilding,
  DifficultyLevel,
  DIFFICULTY_PRESETS,
  ASSET_AVG_KW,
  FleetVehicle,
  FleetVehicleState,
} from './types';

// ---------- Helper Functions ----------

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomInt(min: number, max: number): number {
  return Math.floor(randomBetween(min, max + 1));
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateId(prefix: string, index: number): string {
  return `${prefix}_${String(index).padStart(4, '0')}`;
}

function normalRandom(mean: number = 0, std: number = 1): number {
  // Box-Muller transform
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * std;
}

// ---------- Weather Generation ----------

function generateWeatherTimeSeries(
  timesteps: number,
  startHour: number,
  isCooling: boolean
): number[] {
  // Generate realistic temperature curve
  const temps: number[] = [];
  const baseTemp = isCooling ? 85 : 35; // Summer vs winter baseline
  const amplitude = isCooling ? 15 : 10; // Daily swing

  for (let t = 0; t < timesteps; t++) {
    const hour = (startHour + t * (5 / 60)) % 24;
    // Peak at 3pm (15:00), minimum at 5am
    const dailyCycle = -Math.cos((hour - 15) * Math.PI / 12);
    const noise = normalRandom(0, 2);
    temps.push(baseTemp + amplitude * dailyCycle * 0.5 + noise);
  }

  return temps;
}

// ---------- Individual Asset Generators ----------

function generateHvacResi(id: string, mode: 'cooling' | 'heating', outdoorTemp: number): HvacResi {
  const isCooling = mode === 'cooling';
  const prefSetpoint = isCooling ? randomBetween(72, 76) : randomBetween(68, 72);

  return {
    id,
    type: 'hvac_resi',
    params: {
      mode,
      pref_setpoint_f: prefSetpoint,
      comfort_max_f: isCooling ? 78 : 85,
      comfort_min_f: isCooling ? 60 : 66,
      alpha: randomBetween(0.03, 0.08),
      beta: isCooling ? -randomBetween(0.3, 0.7) : randomBetween(0.3, 0.7),
      hvac_kw: randomBetween(2, 6),
      deadband_f: 0.5,
    },
    state: {
      tin_f: prefSetpoint + normalRandom(0, 1),
      hvac_on: Math.random() > 0.5,
      setpoint_f: prefSetpoint,
      dropped: false,
      baseline_bias: normalRandom(0, 0.03),
      baseline_drift: 0,
    },
  };
}

function generateBatteryResi(id: string): BatteryResi {
  const capacity = randomBetween(7, 13.5);
  const maxPower = randomBetween(3, 5);

  return {
    id,
    type: 'battery_resi',
    params: {
      e_kwh: capacity,
      p_dis_kw: maxPower,
      p_ch_kw: maxPower,
      soc_reserve: 0.20,
    },
    state: {
      soc: randomBetween(0.4, 0.9),
      dropped: false,
      baseline_bias: normalRandom(0, 0.03),
      baseline_drift: 0,
    },
  };
}

function generateEvResi(id: string, timesteps: number): EvResi {
  // Arrival patterns: ~40% plugged in at start (increased from 27%)
  // This gives EVs more time to participate in the event
  const arrivalPattern = Math.random();
  let tArrival: number;
  if (arrivalPattern < 0.40) {
    // ~40% already plugged in at event start (increased from 27%)
    tArrival = 0;
  } else if (arrivalPattern < 0.70) {
    // ~30% arrive during first quarter of event (reduced window)
    tArrival = randomInt(1, Math.floor(timesteps * 0.25));
  } else if (arrivalPattern < 0.88) {
    // ~18% arrive during second quarter of event
    tArrival = randomInt(Math.floor(timesteps * 0.25), Math.floor(timesteps * 0.5));
  } else {
    // ~12% arrive during second half (reduced from previous)
    tArrival = randomInt(Math.floor(timesteps * 0.5), Math.floor(timesteps * 0.75));
  }

  // Departure patterns: Most EVs stay plugged in throughout the event
  const departPattern = Math.random();
  let tDepart: number;
  if (departPattern < 0.88) {
    // 88% stay until end of event (increased from 85%)
    tDepart = timesteps - 1;
  } else if (departPattern < 0.96) {
    // 8% depart late in event
    tDepart = randomInt(Math.max(tArrival + 12, Math.floor(timesteps * 0.8)), timesteps - 1);
  } else {
    // 4% depart mid-event (reduced from 5%)
    tDepart = randomInt(Math.max(tArrival + 10, Math.floor(timesteps * 0.6)), timesteps - 1);
  }

  // Energy needs - REDUCED to give more flexibility before override triggers
  // Typical DR events are 2-4 hours, so EVs shouldn't need massive amounts
  const needPattern = Math.random();
  let eReq: number;
  if (needPattern < 0.40) {
    // 40% need minimal energy (commute top-up) - increased from 30%
    eReq = randomBetween(3, 8);
  } else if (needPattern < 0.85) {
    // 45% need moderate energy - reduced upper bound from 25 to 18
    eReq = randomBetween(8, 18);
  } else {
    // 15% need significant energy - reduced from 20%, upper bound from 50 to 30
    eReq = randomBetween(18, 30);
  }

  const isL2 = Math.random() > 0.25; // 75% L2 chargers (slightly increased)
  const pMax = isL2 ? randomChoice([6.6, 7.2, 9.6]) : 1.4;
  const capacity = randomBetween(50, 80);

  // Start with higher initial charge (40-65% instead of 20-50%)
  // This gives more buffer before needing to charge urgently
  const initialCharge = randomBetween(capacity * 0.40, capacity * 0.65);

  return {
    id,
    type: 'ev_resi',
    params: {
      charger_level: isL2 ? 'L2' : 'L1',
      p_max_kw: pMax,
      e_req_kwh: eReq,
      e_capacity_kwh: capacity,
      t_arrival: tArrival,
      t_depart: tDepart,
    },
    state: {
      e_kwh: initialCharge,
      plugged: tArrival === 0,
      dropped: false,
      override_active: false,
      baseline_bias: normalRandom(0, 0.03),
      baseline_drift: 0,
    },
  };
}

function generateFleetSite(id: string, timesteps: number): FleetSite {
  const numVehicles = randomInt(10, 60);
  const siteMaxPower = randomBetween(50, 300);

  const vehicles: FleetVehicle[] = [];
  const vehicleState: Record<string, FleetVehicleState> = {};

  for (let i = 0; i < numVehicles; i++) {
    const vehId = `${id}_v${i}`;
    const tArr = randomInt(0, Math.floor(timesteps * 0.3));
    const tDep = randomInt(Math.floor(timesteps * 0.7), timesteps - 1);
    const capacity = randomBetween(60, 150);

    vehicles.push({
      id: vehId,
      p_max_kw: randomBetween(7, 19),
      e_req_kwh: randomBetween(30, 100),
      e_capacity_kwh: capacity,
      t_arrival: tArr,
      t_depart: tDep,
    });

    vehicleState[vehId] = {
      e_kwh: randomBetween(capacity * 0.1, capacity * 0.4),
      plugged: tArr === 0,
    };
  }

  return {
    id,
    type: 'fleet_site',
    params: {
      u_site_max_kw: siteMaxPower,
      vehicles,
    },
    state: {
      vehicle_state: vehicleState,
      dropped: false,
      baseline_bias: normalRandom(0, 0.03),
      baseline_drift: 0,
    },
  };
}

function generateCiBuilding(id: string): CiBuilding {
  return {
    id,
    type: 'ci_building',
    params: {
      smax_hvac_kw: randomBetween(20, 150),
      fatigue_k: randomBetween(0.5, 1.5),
      fatigue_a: randomBetween(0.1, 0.3),
      fatigue_b: randomBetween(0.05, 0.15),
      process_load_kw: randomBetween(50, 200),
      max_process_toggles: randomInt(1, 3),
      business_hours: { start_hour: 8, end_hour: 18 },
    },
    state: {
      fatigue: 0,
      hvac_shed_kw: 0,
      process_on: true,
      process_toggles_used: 0,
      dropped: false,
      baseline_bias: normalRandom(0, 0.03),
      baseline_drift: 0,
    },
  };
}

// ---------- Main Scenario Generator ----------

export interface ScenarioGeneratorConfig {
  difficulty: DifficultyLevel;
  assetTypes: AssetType[];
  assetCounts?: Partial<Record<AssetType, number>>;
  eventDurationHours?: number;
  startHour?: number;
  isCoolingSeason?: boolean;
}

export function generateScenario(config: ScenarioGeneratorConfig): Scenario {
  const preset = DIFFICULTY_PRESETS[config.difficulty];
  const eventDurationHours = config.eventDurationHours ?? 4;
  const timesteps = eventDurationHours * 12; // 5-minute intervals
  const startHour = config.startHour ?? 17; // 5pm default
  const isCooling = config.isCoolingSeason ?? true;

  // Generate weather
  const weather = {
    outdoor_temp_f: generateWeatherTimeSeries(timesteps, startHour, isCooling),
  };

  // Calculate required capacity based on MW target and headroom
  // target_mw * 1000 = target in kW
  // headroom_multiplier determines how much extra capacity we need
  const targetKw = preset.target_mw * 1000;
  const requiredCapacityKw = targetKw * preset.headroom_multiplier;

  // Asset type weights for realistic utility-scale distribution
  // At utility scale, C&I and Fleet contribute more of the capacity
  // but residential assets still dominate by count
  const assetWeights: Record<AssetType, number> = {
    hvac_resi: 35,      // 35% of capacity from residential HVAC
    battery_resi: 20,   // 20% from home batteries
    ev_resi: 15,        // 15% from residential EV
    fleet_site: 15,     // 15% from fleet charging sites
    ci_building: 15,    // 15% from C&I buildings
  };

  // Calculate total weight for selected asset types only
  const selectedWeights = config.assetTypes.reduce(
    (sum, type) => sum + assetWeights[type],
    0
  );

  // Calculate asset counts based on required capacity and average kW per asset
  const assetCounts: Record<AssetType, number> = {
    hvac_resi: 0,
    battery_resi: 0,
    ev_resi: 0,
    fleet_site: 0,
    ci_building: 0,
  };

  config.assetTypes.forEach((type) => {
    if (config.assetCounts?.[type] !== undefined) {
      assetCounts[type] = config.assetCounts[type]!;
    } else {
      // Calculate capacity this asset type should provide
      const proportion = assetWeights[type] / selectedWeights;
      const capacityForType = requiredCapacityKw * proportion;

      // Calculate how many assets needed to reach that capacity
      const avgKw = ASSET_AVG_KW[type];
      let count = Math.ceil(capacityForType / avgKw);

      // Ensure at least 1 asset of each selected type
      count = Math.max(1, count);

      assetCounts[type] = count;
    }
  });

  // Generate assets
  const assets: Asset[] = [];
  let assetIndex = 0;

  // HVAC
  for (let i = 0; i < assetCounts.hvac_resi; i++) {
    assets.push(generateHvacResi(
      generateId('hvac', assetIndex++),
      isCooling ? 'cooling' : 'heating',
      weather.outdoor_temp_f[0]
    ));
  }

  // Batteries
  for (let i = 0; i < assetCounts.battery_resi; i++) {
    assets.push(generateBatteryResi(generateId('bat', assetIndex++)));
  }

  // EVs
  for (let i = 0; i < assetCounts.ev_resi; i++) {
    assets.push(generateEvResi(generateId('ev', assetIndex++), timesteps));
  }

  // Fleet sites
  for (let i = 0; i < assetCounts.fleet_site; i++) {
    assets.push(generateFleetSite(generateId('fleet', assetIndex++), timesteps));
  }

  // C&I buildings
  for (let i = 0; i < assetCounts.ci_building; i++) {
    assets.push(generateCiBuilding(generateId('ci', assetIndex++)));
  }

  // Target is directly from difficulty preset (in MW, convert to kW)
  const scenarioTargetKw = preset.target_mw * 1000;

  // Build scenario config
  const startTime = new Date();
  startTime.setHours(startHour, 0, 0, 0);

  const scenarioConfig: ScenarioConfig = {
    start_time: startTime.toISOString(),
    timesteps,
    weather,
    objective: {
      type: 'kw_target',
      target_kw: Math.round(scenarioTargetKw),
    },
    baseline_error: {
      sigma_bias: 0.03,
      sigma_drift: 0.01,
      rho: 0.8,
    },
    measurement_noise: {
      pct_uniform: 0.05,
    },
    noncompliance: {
      probability: preset.noncompliance,
    },
  };

  return {
    scenario: scenarioConfig,
    assets,
  };
}

// Calculate maximum theoretical kW reduction capacity
function calculateMaxCapacity(assets: Asset[]): number {
  let total = 0;

  for (const asset of assets) {
    switch (asset.type) {
      case 'hvac_resi':
        // Can reduce by turning off HVAC
        total += asset.params.hvac_kw;
        break;
      case 'battery_resi':
        // Can discharge at max rate
        total += asset.params.p_dis_kw;
        break;
      case 'ev_resi':
        // Can reduce charging (baseline minus zero)
        total += asset.params.p_max_kw * 0.5; // Assume 50% baseline
        break;
      case 'fleet_site':
        // Can reduce site power
        total += asset.params.u_site_max_kw * 0.6;
        break;
      case 'ci_building':
        // HVAC shed + process load
        total += asset.params.smax_hvac_kw + asset.params.process_load_kw;
        break;
    }
  }

  return total;
}

// Get scenario summary for display
export function getScenarioSummary(scenario: Scenario): {
  duration: string;
  timesteps: number;
  targetKw: number;
  maxCapacityKw: number;
  capacityHeadroom: number; // multiplier (e.g., 3.0 means 3x capacity vs target)
  assetCount: number;
  assetBreakdown: Record<AssetType, number>;
  avgTemp: number;
} {
  const config = scenario.scenario;
  const durationHours = config.timesteps / 12;

  const breakdown: Record<AssetType, number> = {
    hvac_resi: 0,
    battery_resi: 0,
    ev_resi: 0,
    fleet_site: 0,
    ci_building: 0,
  };

  for (const asset of scenario.assets) {
    breakdown[asset.type]++;
  }

  const avgTemp = config.weather.outdoor_temp_f.reduce((a, b) => a + b, 0) / config.weather.outdoor_temp_f.length;
  const maxCapacity = calculateMaxCapacity(scenario.assets);
  const targetKw = config.objective.target_kw ?? 0;
  const capacityHeadroom = targetKw > 0 ? maxCapacity / targetKw : 0;

  return {
    duration: `${durationHours} hours`,
    timesteps: config.timesteps,
    targetKw,
    maxCapacityKw: Math.round(maxCapacity),
    capacityHeadroom: Math.round(capacityHeadroom * 10) / 10,
    assetCount: scenario.assets.length,
    assetBreakdown: breakdown,
    avgTemp: Math.round(avgTemp),
  };
}
