// ============================================
// VPP Simulation Game - Dispatch Strategies
// Rule-based, Greedy, and Stochastic algorithms
// With sub-strategies and aggressiveness controls
// ============================================

import {
  Asset,
  DispatchCommand,
  HvacResi,
  BatteryResi,
  EvResi,
  FleetSite,
  CiBuilding,
  DispatchStrategy,
  SubStrategy,
  RuleBasedSubStrategy,
  GreedySubStrategy,
  StochasticSubStrategy,
  AggressivenessSettings,
  ScenarioConfig,
  AssetType,
} from './types';

// ---------- Strategy Interface ----------

export interface StrategyContext {
  assets: Asset[];
  targetKw: number;
  currentTimestep: number;
  totalTimesteps: number;
  config: ScenarioConfig;
  subStrategy: SubStrategy;
  aggressiveness: AggressivenessSettings;
}

export type DispatchFunction = (context: StrategyContext) => DispatchCommand[];

// ---------- Helper Functions ----------

function getAggressivenessMultiplier(aggressiveness: number): number {
  // Convert 0-100 scale to 0.2-1.0 multiplier
  return 0.2 + (aggressiveness / 100) * 0.8;
}

function getAvailableCapacity(asset: Asset, timestep: number): number {
  switch (asset.type) {
    case 'hvac_resi':
      if (asset.state.dropped) return 0;
      return asset.params.hvac_kw;
    case 'battery_resi':
      if (asset.state.dropped) return 0;
      const availableSoc = asset.state.soc - asset.params.soc_reserve;
      return Math.min(asset.params.p_dis_kw, availableSoc * asset.params.e_kwh * 12);
    case 'ev_resi':
      if (asset.state.dropped || asset.state.override_active || !asset.state.plugged) return 0;
      return asset.params.p_max_kw;
    case 'fleet_site':
      if (asset.state.dropped) return 0;
      return asset.params.u_site_max_kw * 0.7;
    case 'ci_building':
      if (asset.state.dropped) return 0;
      const hvacAvail = asset.params.smax_hvac_kw * Math.exp(-asset.params.fatigue_k * asset.state.fatigue);
      const processAvail = asset.state.process_on ? asset.params.process_load_kw : 0;
      return hvacAvail + processAvail;
    default:
      return 0;
  }
}

// Estimate drop-off risk for an asset (0-1)
function estimateDropRisk(asset: Asset, aggressivenessMultiplier: number): number {
  switch (asset.type) {
    case 'hvac_resi': {
      const hvac = asset as HvacResi;
      const isCooling = hvac.params.mode === 'cooling';
      const tempMargin = isCooling
        ? hvac.params.comfort_max_f - hvac.state.tin_f
        : hvac.state.tin_f - hvac.params.comfort_min_f;
      // Higher aggressiveness = higher risk
      return Math.max(0, Math.min(1, (1 - tempMargin / 4) * aggressivenessMultiplier));
    }
    case 'battery_resi': {
      const bat = asset as BatteryResi;
      const socMargin = bat.state.soc - bat.params.soc_reserve;
      return Math.max(0, Math.min(1, (1 - socMargin) * 0.5));
    }
    case 'ev_resi': {
      const ev = asset as EvResi;
      if (ev.state.override_active) return 1;
      const energyNeeded = ev.params.e_req_kwh - ev.state.e_kwh;
      return energyNeeded > 20 ? 0.6 : energyNeeded > 10 ? 0.3 : 0.1;
    }
    case 'ci_building': {
      const ci = asset as CiBuilding;
      return Math.min(1, ci.state.fatigue * 0.8);
    }
    default:
      return 0.2;
  }
}

// ---------- Rule-Based Strategies ----------

type AssetGroup = {
  batteries: BatteryResi[];
  hvacs: HvacResi[];
  evs: EvResi[];
  fleets: FleetSite[];
  ciBuildings: CiBuilding[];
};

function groupAssets(assets: Asset[]): AssetGroup {
  return {
    batteries: assets.filter(a => a.type === 'battery_resi' && !a.state.dropped) as BatteryResi[],
    hvacs: assets.filter(a => a.type === 'hvac_resi' && !a.state.dropped) as HvacResi[],
    evs: assets.filter(a => a.type === 'ev_resi' && !a.state.dropped && a.state.plugged && !a.state.override_active) as EvResi[],
    fleets: assets.filter(a => a.type === 'fleet_site' && !a.state.dropped) as FleetSite[],
    ciBuildings: assets.filter(a => a.type === 'ci_building' && !a.state.dropped) as CiBuilding[],
  };
}

function dispatchBatteries(
  batteries: BatteryResi[],
  remainingTarget: number,
  aggressiveness: number,
  context: StrategyContext
): { commands: DispatchCommand[]; remaining: number } {
  const commands: DispatchCommand[] = [];
  const mult = getAggressivenessMultiplier(aggressiveness);

  for (const bat of batteries) {
    if (remainingTarget <= 0) break;
    const available = getAvailableCapacity(bat, context.currentTimestep);
    const dispatch = Math.min(available * mult, remainingTarget);
    commands.push({
      asset_id: bat.id,
      command: { type: 'battery', power_kw: dispatch },
    });
    remainingTarget -= dispatch;
  }

  return { commands, remaining: remainingTarget };
}

function dispatchHvacs(
  hvacs: HvacResi[],
  remainingTarget: number,
  aggressiveness: number,
  context: StrategyContext
): { commands: DispatchCommand[]; remaining: number } {
  const commands: DispatchCommand[] = [];
  const mult = getAggressivenessMultiplier(aggressiveness);
  // Aggressiveness maps to setpoint shift: 0% -> 0.5°F, 100% -> 2°F
  const baseShift = 0.5 + mult * 1.5;

  for (const hvac of hvacs) {
    if (remainingTarget <= 0) break;
    const shift = hvac.params.mode === 'cooling'
      ? Math.min(2, baseShift)
      : Math.max(-2, -baseShift);
    commands.push({
      asset_id: hvac.id,
      command: { type: 'hvac', delta_setpoint_f: Math.round(shift) },
    });
    remainingTarget -= hvac.params.hvac_kw * mult * 0.5;
  }

  return { commands, remaining: remainingTarget };
}

function dispatchEvs(
  evs: EvResi[],
  remainingTarget: number,
  aggressiveness: number,
  context: StrategyContext
): { commands: DispatchCommand[]; remaining: number } {
  const commands: DispatchCommand[] = [];
  const mult = getAggressivenessMultiplier(aggressiveness);
  // Aggressiveness maps to charge reduction: 0% -> 80% charge, 100% -> 0% charge
  const chargeRatio = 1 - mult;

  for (const ev of evs) {
    if (remainingTarget <= 0) break;
    const chargePower = ev.params.p_max_kw * chargeRatio;
    commands.push({
      asset_id: ev.id,
      command: { type: 'ev', power_kw: chargePower },
    });
    remainingTarget -= ev.params.p_max_kw * mult;
  }

  return { commands, remaining: remainingTarget };
}

function dispatchFleets(
  fleets: FleetSite[],
  remainingTarget: number,
  aggressiveness: number,
  context: StrategyContext
): { commands: DispatchCommand[]; remaining: number } {
  const commands: DispatchCommand[] = [];
  const mult = getAggressivenessMultiplier(aggressiveness);
  // Aggressiveness maps to power cap: 0% -> 90% cap, 100% -> 10% cap
  const capRatio = 0.9 - mult * 0.8;

  for (const fleet of fleets) {
    if (remainingTarget <= 0) break;
    const capPower = fleet.params.u_site_max_kw * capRatio;
    commands.push({
      asset_id: fleet.id,
      command: { type: 'fleet', site_power_cap_kw: capPower },
    });
    remainingTarget -= fleet.params.u_site_max_kw * (1 - capRatio);
  }

  return { commands, remaining: remainingTarget };
}

function dispatchCiBuildings(
  ciBuildings: CiBuilding[],
  remainingTarget: number,
  aggressiveness: number,
  context: StrategyContext
): { commands: DispatchCommand[]; remaining: number } {
  const commands: DispatchCommand[] = [];
  const mult = getAggressivenessMultiplier(aggressiveness);
  // Aggressiveness maps to shed ratio and process curtailment willingness
  const shedRatio = mult;
  const curtailProcess = mult > 0.7;

  for (const ci of ciBuildings) {
    if (remainingTarget <= 0) break;
    const availShed = ci.params.smax_hvac_kw * Math.exp(-ci.params.fatigue_k * ci.state.fatigue);
    const shedAmount = availShed * shedRatio;
    const processContrib = curtailProcess && ci.state.process_on ? ci.params.process_load_kw : 0;
    commands.push({
      asset_id: ci.id,
      command: {
        type: 'ci_building',
        hvac_shed_kw: shedAmount,
        process_on: !curtailProcess || !ci.state.process_on,
      },
    });
    remainingTarget -= shedAmount + processContrib;
  }

  return { commands, remaining: remainingTarget };
}

// Priority orders for rule-based sub-strategies
type AssetCategory = 'batteries' | 'hvacs' | 'evs' | 'fleets' | 'ciBuildings';

const RULE_BASED_PRIORITY_ORDERS: Record<RuleBasedSubStrategy, AssetCategory[]> = {
  batteries_first: ['batteries', 'hvacs', 'evs', 'fleets', 'ciBuildings'],
  hvac_first: ['hvacs', 'batteries', 'evs', 'fleets', 'ciBuildings'],
  load_reduction_first: ['evs', 'fleets', 'batteries', 'hvacs', 'ciBuildings'],
  balanced: ['batteries', 'hvacs', 'evs', 'fleets', 'ciBuildings'], // Will use round-robin
};

function ruleBasedDispatch(context: StrategyContext): DispatchCommand[] {
  const subStrategy = context.subStrategy as RuleBasedSubStrategy;
  const groups = groupAssets(context.assets);
  const agg = context.aggressiveness;
  let commands: DispatchCommand[] = [];
  let remainingTarget = context.targetKw;

  if (subStrategy === 'balanced') {
    // Balanced: dispatch proportionally across all types
    const totalCapacity =
      groups.batteries.reduce((s, b) => s + getAvailableCapacity(b, context.currentTimestep), 0) +
      groups.hvacs.reduce((s, h) => s + h.params.hvac_kw, 0) +
      groups.evs.reduce((s, e) => s + e.params.p_max_kw, 0) +
      groups.fleets.reduce((s, f) => s + f.params.u_site_max_kw * 0.7, 0) +
      groups.ciBuildings.reduce((s, c) => s + c.params.smax_hvac_kw, 0);

    if (totalCapacity > 0) {
      const ratio = Math.min(1, context.targetKw / totalCapacity);

      // Dispatch each type with proportional target
      const batResult = dispatchBatteries(groups.batteries, context.targetKw * ratio, agg.battery_resi, context);
      const hvacResult = dispatchHvacs(groups.hvacs, context.targetKw * ratio, agg.hvac_resi, context);
      const evResult = dispatchEvs(groups.evs, context.targetKw * ratio, agg.ev_resi, context);
      const fleetResult = dispatchFleets(groups.fleets, context.targetKw * ratio, agg.fleet_site, context);
      const ciResult = dispatchCiBuildings(groups.ciBuildings, context.targetKw * ratio, agg.ci_building, context);

      commands = [...batResult.commands, ...hvacResult.commands, ...evResult.commands, ...fleetResult.commands, ...ciResult.commands];
    }
  } else {
    // Priority-based dispatch
    const priorityOrder = RULE_BASED_PRIORITY_ORDERS[subStrategy];

    for (const category of priorityOrder) {
      if (remainingTarget <= 0) break;

      let result: { commands: DispatchCommand[]; remaining: number };
      switch (category) {
        case 'batteries':
          result = dispatchBatteries(groups.batteries, remainingTarget, agg.battery_resi, context);
          break;
        case 'hvacs':
          result = dispatchHvacs(groups.hvacs, remainingTarget, agg.hvac_resi, context);
          break;
        case 'evs':
          result = dispatchEvs(groups.evs, remainingTarget, agg.ev_resi, context);
          break;
        case 'fleets':
          result = dispatchFleets(groups.fleets, remainingTarget, agg.fleet_site, context);
          break;
        case 'ciBuildings':
          result = dispatchCiBuildings(groups.ciBuildings, remainingTarget, agg.ci_building, context);
          break;
      }
      commands.push(...result.commands);
      remainingTarget = result.remaining;
    }
  }

  return commands;
}

// ---------- Greedy Strategies ----------

function greedyDispatch(context: StrategyContext): DispatchCommand[] {
  const subStrategy = context.subStrategy as GreedySubStrategy;
  const agg = context.aggressiveness;
  const commands: DispatchCommand[] = [];
  let remainingTarget = context.targetKw;

  // Build asset list with capacity and risk info
  const assetsWithInfo = context.assets
    .filter(a => !a.state.dropped)
    .map(a => {
      const aggMult = getAggressivenessMultiplier(agg[a.type as AssetType]);
      return {
        asset: a,
        capacity: getAvailableCapacity(a, context.currentTimestep) * aggMult,
        risk: estimateDropRisk(a, aggMult),
        efficiency: getAvailableCapacity(a, context.currentTimestep) / Math.max(0.1, estimateDropRisk(a, aggMult)),
        aggMult,
      };
    })
    .filter(a => a.capacity > 0);

  // Sort based on sub-strategy
  switch (subStrategy) {
    case 'max_capacity':
      assetsWithInfo.sort((a, b) => b.capacity - a.capacity);
      break;
    case 'lowest_risk':
      assetsWithInfo.sort((a, b) => a.risk - b.risk);
      break;
    case 'efficiency_optimized':
      assetsWithInfo.sort((a, b) => b.efficiency - a.efficiency);
      break;
  }

  for (const { asset, capacity, aggMult } of assetsWithInfo) {
    if (remainingTarget <= 0) break;

    const dispatchAmount = Math.min(capacity, remainingTarget);

    switch (asset.type) {
      case 'battery_resi':
        commands.push({
          asset_id: asset.id,
          command: { type: 'battery', power_kw: dispatchAmount },
        });
        remainingTarget -= dispatchAmount;
        break;

      case 'hvac_resi': {
        const hvac = asset as HvacResi;
        const shift = hvac.params.mode === 'cooling'
          ? Math.round(2 * aggMult)
          : Math.round(-2 * aggMult);
        commands.push({
          asset_id: asset.id,
          command: { type: 'hvac', delta_setpoint_f: Math.max(-2, Math.min(2, shift)) },
        });
        remainingTarget -= hvac.params.hvac_kw * aggMult;
        break;
      }

      case 'ev_resi': {
        const ev = asset as EvResi;
        const chargePower = ev.params.p_max_kw * (1 - aggMult);
        commands.push({
          asset_id: asset.id,
          command: { type: 'ev', power_kw: chargePower },
        });
        remainingTarget -= ev.params.p_max_kw * aggMult;
        break;
      }

      case 'fleet_site': {
        const fleet = asset as FleetSite;
        const capPower = fleet.params.u_site_max_kw * (1 - aggMult * 0.9);
        commands.push({
          asset_id: asset.id,
          command: { type: 'fleet', site_power_cap_kw: capPower },
        });
        remainingTarget -= fleet.params.u_site_max_kw * aggMult * 0.7;
        break;
      }

      case 'ci_building': {
        const ci = asset as CiBuilding;
        const shedAmount = ci.params.smax_hvac_kw * aggMult;
        commands.push({
          asset_id: asset.id,
          command: {
            type: 'ci_building',
            hvac_shed_kw: shedAmount,
            process_on: aggMult < 0.8,
          },
        });
        remainingTarget -= capacity;
        break;
      }
    }
  }

  return commands;
}

// ---------- Stochastic Strategies ----------

function stochasticDispatch(context: StrategyContext): DispatchCommand[] {
  const subStrategy = context.subStrategy as StochasticSubStrategy;
  const agg = context.aggressiveness;
  const commands: DispatchCommand[] = [];
  const numSamples = 10;
  const lookaheadSteps = Math.min(6, context.totalTimesteps - context.currentTimestep);
  const remainingRatio = (context.totalTimesteps - context.currentTimestep) / context.totalTimesteps;

  // Sub-strategy modifies the base conservation factor
  let conservationFactor: number;
  switch (subStrategy) {
    case 'risk_averse':
      // Always more conservative
      conservationFactor = 0.5 + 0.4 * remainingRatio;
      break;
    case 'opportunity_seeking':
      // More aggressive, especially when behind
      conservationFactor = 0.2 + 0.3 * remainingRatio;
      break;
    case 'deadline_aware':
      // Very conservative early, very aggressive late
      conservationFactor = Math.pow(remainingRatio, 1.5);
      break;
  }

  for (const asset of context.assets) {
    if (asset.state.dropped) continue;

    const aggMult = getAggressivenessMultiplier(agg[asset.type as AssetType]);
    const capacity = getAvailableCapacity(asset, context.currentTimestep);
    if (capacity <= 0) continue;

    // Sample expected drop-off risk
    let avgDropRisk = 0;
    for (let s = 0; s < numSamples; s++) {
      let dropEvents = 0;
      for (let t = 0; t < lookaheadSteps; t++) {
        if (Math.random() < context.config.noncompliance.probability) {
          dropEvents++;
        }
      }
      avgDropRisk += dropEvents / lookaheadSteps;
    }
    avgDropRisk /= numSamples;

    // Combine conservation factor with aggressiveness
    const effectiveConservation = conservationFactor * (1.2 - aggMult);

    switch (asset.type) {
      case 'battery_resi': {
        const bat = asset as BatteryResi;
        const reserveMultiplier = 1 + effectiveConservation * 0.5;
        const effectiveReserve = Math.min(0.5, bat.params.soc_reserve * reserveMultiplier);
        const availSoc = bat.state.soc - effectiveReserve;
        const safePower = Math.min(bat.params.p_dis_kw, availSoc * bat.params.e_kwh * 12);
        commands.push({
          asset_id: asset.id,
          command: { type: 'battery', power_kw: Math.max(0, safePower * aggMult * (1 - effectiveConservation * 0.3)) },
        });
        break;
      }

      case 'hvac_resi': {
        const hvac = asset as HvacResi;
        const baseShift = hvac.params.mode === 'cooling' ? 1 : -1;
        const scaledShift = Math.round(baseShift * aggMult * (1 + (1 - effectiveConservation)));
        commands.push({
          asset_id: asset.id,
          command: { type: 'hvac', delta_setpoint_f: Math.max(-2, Math.min(2, scaledShift)) },
        });
        break;
      }

      case 'ev_resi': {
        const ev = asset as EvResi;
        const chargeRate = ev.params.p_max_kw * (effectiveConservation + (1 - aggMult) * 0.5);
        commands.push({
          asset_id: asset.id,
          command: { type: 'ev', power_kw: Math.min(ev.params.p_max_kw, chargeRate) },
        });
        break;
      }

      case 'fleet_site': {
        const fleet = asset as FleetSite;
        const capRatio = 0.3 + effectiveConservation * 0.4 + (1 - aggMult) * 0.2;
        commands.push({
          asset_id: asset.id,
          command: { type: 'fleet', site_power_cap_kw: fleet.params.u_site_max_kw * capRatio },
        });
        break;
      }

      case 'ci_building': {
        const ci = asset as CiBuilding;
        const shedRatio = Math.min(0.9, aggMult * (1 - effectiveConservation * 0.5));
        const shedAmount = ci.params.smax_hvac_kw * shedRatio * (1 - ci.state.fatigue);
        // Deadline-aware: curtail process only near end; others based on aggressiveness
        const curtailProcess = subStrategy === 'deadline_aware'
          ? remainingRatio < 0.2
          : aggMult > 0.7 && remainingRatio < 0.5;
        commands.push({
          asset_id: asset.id,
          command: {
            type: 'ci_building',
            hvac_shed_kw: shedAmount,
            process_on: !curtailProcess,
          },
        });
        break;
      }
    }
  }

  return commands;
}

// ---------- Strategy Registry ----------

export const DISPATCH_STRATEGIES: Record<DispatchStrategy, DispatchFunction> = {
  rule_based: ruleBasedDispatch,
  greedy: greedyDispatch,
  stochastic: stochasticDispatch,
};

export const STRATEGY_INFO: Record<DispatchStrategy, { name: string; description: string }> = {
  rule_based: {
    name: 'Rule-Based',
    description: 'Follows a configurable priority order with moderate dispatch levels. Balanced approach suitable for most scenarios.',
  },
  greedy: {
    name: 'Greedy',
    description: 'Maximizes kW reduction by dispatching assets based on capacity, risk, or efficiency. High performance but watch for drop-offs.',
  },
  stochastic: {
    name: 'Stochastic',
    description: 'Uses Monte Carlo sampling to account for uncertainty. Balances conservation vs opportunity based on sub-strategy.',
  },
};

// ---------- Execute Strategy ----------

export function executeStrategy(
  strategy: DispatchStrategy,
  context: StrategyContext
): DispatchCommand[] {
  const dispatchFn = DISPATCH_STRATEGIES[strategy];
  return dispatchFn(context);
}
