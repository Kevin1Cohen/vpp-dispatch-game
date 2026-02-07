// ============================================
// VPP Simulation Game - Composable Dispatch Strategies
// Based on canonical VPP dispatch strategy taxonomy
// ============================================

import {
  Asset,
  DispatchCommand,
  HvacResi,
  BatteryResi,
  EvResi,
  FleetSite,
  CiBuilding,
  ScenarioConfig,
  AssetType,
  StrategyConfig,
  DecisionFramework,
  FrameworkSubtype,
  ObjectiveFunction,
  SelectionOrdering,
  RiskPosture,
  FeedbackMode,
  RISK_POSTURE_PARAMS,
  RiskPostureParams,
  DEFAULT_STRATEGY_CONFIG,
  DispatchIntensitySettings,
  DEFAULT_DISPATCH_INTENSITY,
} from './types';

// ============================================
// STRATEGY CONTEXT
// ============================================

export interface StrategyContext {
  assets: Asset[];
  targetKw: number;
  currentTimestep: number;
  totalTimesteps: number;
  config: ScenarioConfig;
  strategyConfig: StrategyConfig;
  // Dispatch intensity: per-asset-type control (0-100)
  // Affects both dispatch priority and capacity utilization
  dispatchIntensity: DispatchIntensitySettings;
  // Feedback from previous timestep
  previousAchievedKw: number | null;
  previouslyDispatchedAssetIds: Set<string>;
  // Accumulated error for PID-like control
  accumulatedError: number;
  // Asset performance tracking (for adaptive weighting)
  assetPerformanceScores: Map<string, number>;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getRiskParams(riskPosture: RiskPosture): RiskPostureParams {
  return RISK_POSTURE_PARAMS[riskPosture];
}

// Get available capacity for an asset at current timestep
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
function estimateDropRisk(asset: Asset, riskParams: RiskPostureParams): number {
  const conservationFactor = riskParams.conservationFactor;

  switch (asset.type) {
    case 'hvac_resi': {
      const hvac = asset as HvacResi;
      const isCooling = hvac.params.mode === 'cooling';
      const tempMargin = isCooling
        ? hvac.params.comfort_max_f - hvac.state.tin_f
        : hvac.state.tin_f - hvac.params.comfort_min_f;
      return Math.max(0, Math.min(1, (1 - tempMargin / 4) * (1 - conservationFactor * 0.5)));
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

// Calculate comfort cost for dispatching an asset
function calculateComfortCost(asset: Asset): number {
  switch (asset.type) {
    case 'hvac_resi': {
      const hvac = asset as HvacResi;
      const isCooling = hvac.params.mode === 'cooling';
      const tempMargin = isCooling
        ? hvac.params.comfort_max_f - hvac.state.tin_f
        : hvac.state.tin_f - hvac.params.comfort_min_f;
      return Math.max(0, 4 - tempMargin); // Higher cost when closer to comfort limit
    }
    case 'ev_resi': {
      const ev = asset as EvResi;
      const chargeNeeded = ev.params.e_req_kwh - ev.state.e_kwh;
      const timeRemaining = ev.params.t_depart - ev.params.t_arrival;
      return chargeNeeded / Math.max(1, timeRemaining); // Higher cost when tight on time
    }
    case 'ci_building': {
      const ci = asset as CiBuilding;
      return ci.state.fatigue * 2; // Fatigue increases comfort cost
    }
    default:
      return 0.5; // Moderate cost for batteries and fleets
  }
}

// Calculate SOC/headroom buffer for an asset
function calculateHeadroom(asset: Asset): number {
  switch (asset.type) {
    case 'battery_resi': {
      const bat = asset as BatteryResi;
      return (bat.state.soc - bat.params.soc_reserve) * bat.params.e_kwh;
    }
    case 'ev_resi': {
      const ev = asset as EvResi;
      if (!ev.state.plugged) return 0;
      return ev.state.e_kwh - ev.params.e_req_kwh * 0.2; // Buffer above minimum needed
    }
    case 'hvac_resi': {
      const hvac = asset as HvacResi;
      const isCooling = hvac.params.mode === 'cooling';
      return isCooling
        ? hvac.params.comfort_max_f - hvac.state.tin_f
        : hvac.state.tin_f - hvac.params.comfort_min_f;
    }
    case 'ci_building': {
      const ci = asset as CiBuilding;
      return (1 - ci.state.fatigue) * ci.params.smax_hvac_kw;
    }
    case 'fleet_site': {
      return asset.params.u_site_max_kw * 0.5; // Assume 50% headroom on average
    }
    default:
      return 0;
  }
}

// ============================================
// RAMP-UP CALCULATION
// ============================================

function calculateRampUpPercentage(context: StrategyContext): number {
  const riskParams = getRiskParams(context.strategyConfig.riskPosture);
  const progress = context.currentTimestep / context.totalTimesteps;

  // Risk posture affects ramp speed
  const initialPct = riskParams.rampUpSpeed;

  // Deadline-aware has special behavior
  if (context.strategyConfig.riskPosture === 'deadline_aware') {
    // Starts very conservative, accelerates as deadline approaches
    const urgency = Math.pow(progress, 0.5); // Square root for acceleration curve
    return Math.min(1, initialPct + (1 - initialPct) * urgency);
  }

  // Standard ramp curve based on risk posture
  const riskPosture = context.strategyConfig.riskPosture;
  const rampDuration = riskPosture === 'risk_averse' ? 0.7 :
                       riskPosture === 'opportunity_seeking' ? 0.4 : 0.5;

  const rampProgress = Math.min(1, progress / rampDuration);
  return Math.min(1, initialPct + (1 - initialPct) * rampProgress);
}

// ============================================
// ASSET SELECTION & ORDERING
// ============================================

interface ScoredAsset {
  asset: Asset;
  capacity: number;
  score: number; // Composite score for ordering
}

// Calculate composite ordering score based on selection orderings
// Dispatch intensity affects the score: higher intensity = higher priority for that asset type
function calculateOrderingScore(
  asset: Asset,
  orderings: SelectionOrdering[],
  context: StrategyContext
): number {
  const riskParams = getRiskParams(context.strategyConfig.riskPosture);
  let totalScore = 0;
  let weightSum = 0;

  // Get dispatch intensity for this asset type (0-100, normalized to 0-1)
  const intensity = (context.dispatchIntensity[asset.type] ?? 50) / 100;
  // Intensity multiplier: 0.5 at intensity=0, 1.0 at intensity=50, 1.5 at intensity=100
  const intensityMultiplier = 0.5 + intensity;

  // Weight decreases for later orderings (primary has most influence)
  orderings.forEach((ordering, index) => {
    const weight = 1 / (index + 1);
    weightSum += weight;

    let orderScore = 0;
    switch (ordering) {
      // Asset Type Based
      case 'batteries_first':
        orderScore = asset.type === 'battery_resi' ? 1 : 0.3;
        break;
      case 'hvac_first':
        orderScore = asset.type === 'hvac_resi' ? 1 : 0.3;
        break;
      case 'high_load_reduction_first':
        orderScore = (asset.type === 'ev_resi' || asset.type === 'fleet_site') ? 1 : 0.3;
        break;
      case 'balanced_weighting':
        orderScore = 0.5; // Equal for all
        break;

      // Performance Based
      case 'highest_trust_score':
        orderScore = context.assetPerformanceScores.get(asset.id) ?? 0.5;
        break;
      case 'lowest_variance':
        // Lower risk = higher score
        orderScore = 1 - estimateDropRisk(asset, riskParams);
        break;
      case 'best_historical_delivery':
        orderScore = context.assetPerformanceScores.get(asset.id) ?? 0.5;
        break;

      // State Based
      case 'highest_headroom':
        const headroom = calculateHeadroom(asset);
        const capacity = getAvailableCapacity(asset, context.currentTimestep);
        orderScore = capacity > 0 ? Math.min(1, headroom / capacity) : 0;
        break;
      case 'lowest_marginal_comfort_cost':
        orderScore = 1 - Math.min(1, calculateComfortCost(asset) / 5);
        break;
      case 'highest_soc_buffer':
        if (asset.type === 'battery_resi') {
          orderScore = (asset as BatteryResi).state.soc;
        } else if (asset.type === 'ev_resi' && (asset as EvResi).state.plugged) {
          const ev = asset as EvResi;
          orderScore = ev.state.e_kwh / ev.params.e_capacity_kwh;
        } else {
          orderScore = 0.5;
        }
        break;

      // Fairness Based
      case 'least_recently_dispatched':
        orderScore = context.previouslyDispatchedAssetIds.has(asset.id) ? 0.2 : 0.8;
        break;
      case 'round_robin':
        // Use asset ID hash for consistent rotation
        orderScore = (parseInt(asset.id.replace(/\D/g, ''), 10) % 100) / 100;
        break;
      case 'fatigue_balanced':
        if (asset.type === 'ci_building') {
          orderScore = 1 - (asset as CiBuilding).state.fatigue;
        } else {
          orderScore = 0.8; // Non-CI assets assumed low fatigue
        }
        break;
    }

    totalScore += orderScore * weight;
  });

  // Apply intensity multiplier to final score
  // This means higher intensity assets get dispatched earlier
  return (totalScore / weightSum) * intensityMultiplier;
}

// Select and order assets for dispatch
function selectAndOrderAssets(context: StrategyContext): ScoredAsset[] {
  const riskParams = getRiskParams(context.strategyConfig.riskPosture);
  const rampPercentage = calculateRampUpPercentage(context);

  // Score all available assets
  const scoredAssets: ScoredAsset[] = context.assets
    .filter(a => !a.state.dropped)
    .map(a => ({
      asset: a,
      capacity: getAvailableCapacity(a, context.currentTimestep),
      score: calculateOrderingScore(a, context.strategyConfig.selectionOrderings, context),
    }))
    .filter(sa => sa.capacity > 0);

  // Sort by score (descending)
  scoredAssets.sort((a, b) => b.score - a.score);

  // Apply ramp-up: select subset based on percentage
  // Prioritize previously dispatched assets for continuity
  const previouslyDispatched = scoredAssets.filter(sa =>
    context.previouslyDispatchedAssetIds.has(sa.asset.id)
  );
  const notPreviouslyDispatched = scoredAssets.filter(sa =>
    !context.previouslyDispatchedAssetIds.has(sa.asset.id)
  );

  const targetCount = Math.max(1, Math.ceil(scoredAssets.length * rampPercentage));
  const selected = [
    ...previouslyDispatched,
    ...notPreviouslyDispatched.slice(0, Math.max(0, targetCount - previouslyDispatched.length)),
  ];

  return selected;
}

// ============================================
// OBJECTIVE-BASED TARGET ADJUSTMENT
// ============================================

function adjustTargetForObjective(
  context: StrategyContext,
  baseTarget: number
): number {
  const riskParams = getRiskParams(context.strategyConfig.riskPosture);
  const objective = context.strategyConfig.objective;

  switch (objective) {
    case 'capacity':
      // Aim slightly above target to ensure hitting it
      return baseTarget * (1 + riskParams.reserveMargin * 0.5);

    case 'risk_minimization':
      // Conservative target with higher reserve
      return baseTarget * (1 + riskParams.reserveMargin);

    case 'efficiency':
      // Aim for exactly the target, no overshoot
      return baseTarget;

    case 'regret_minimization':
      // High reserve to avoid failures
      return baseTarget * (1 + riskParams.reserveMargin * 1.5);

    case 'learning_oriented':
      // Vary target slightly to learn asset responses
      const variance = Math.sin(context.currentTimestep * 0.5) * 0.1;
      return baseTarget * (1 + variance);

    default:
      return baseTarget;
  }
}

// ============================================
// DECISION FRAMEWORK IMPLEMENTATIONS
// ============================================

// --- Deterministic Policy ---

function deterministicDispatch(context: StrategyContext): DispatchCommand[] {
  const subtype = context.strategyConfig.frameworkSubtype;
  const selectedAssets = selectAndOrderAssets(context);
  const riskParams = getRiskParams(context.strategyConfig.riskPosture);

  let effectiveTarget = adjustTargetForObjective(context, context.targetKw);

  // State machine: adjust behavior based on event phase
  if (subtype === 'state_machine') {
    const progress = context.currentTimestep / context.totalTimesteps;
    if (progress < 0.15) {
      // Ramp phase: conservative dispatch
      effectiveTarget *= 0.7;
    } else if (progress > 0.85) {
      // Recovery phase: wind down gradually
      effectiveTarget *= 0.8 + 0.2 * (1 - progress) / 0.15;
    }
    // Sustain phase: full target (middle 70%)
  }

  // Threshold triggered: only dispatch if below target
  if (subtype === 'threshold_triggered') {
    if (context.previousAchievedKw !== null) {
      const deviation = context.targetKw - context.previousAchievedKw;
      if (deviation < context.targetKw * 0.05) {
        // Within 5% of target, maintain current dispatch
        return maintainPreviousDispatch(context, selectedAssets);
      }
    }
  }

  return dispatchToTarget(selectedAssets, effectiveTarget, context, riskParams);
}

// --- Greedy/Myopic ---

function greedyDispatch(context: StrategyContext): DispatchCommand[] {
  const subtype = context.strategyConfig.frameworkSubtype;
  const riskParams = getRiskParams(context.strategyConfig.riskPosture);
  let selectedAssets = selectAndOrderAssets(context);

  // Re-sort based on greedy subtype
  switch (subtype) {
    case 'max_capacity_now':
      selectedAssets.sort((a, b) => b.capacity - a.capacity);
      break;
    case 'min_risk_now':
      selectedAssets.sort((a, b) =>
        estimateDropRisk(a.asset, riskParams) - estimateDropRisk(b.asset, riskParams)
      );
      break;
    case 'best_efficiency_now':
      selectedAssets.sort((a, b) => {
        const effA = a.capacity / Math.max(0.1, calculateComfortCost(a.asset));
        const effB = b.capacity / Math.max(0.1, calculateComfortCost(b.asset));
        return effB - effA;
      });
      break;
  }

  const effectiveTarget = adjustTargetForObjective(context, context.targetKw);
  return dispatchToTarget(selectedAssets, effectiveTarget, context, riskParams);
}

// --- Stochastic ---

function stochasticDispatch(context: StrategyContext): DispatchCommand[] {
  const subtype = context.strategyConfig.frameworkSubtype;
  const riskParams = getRiskParams(context.strategyConfig.riskPosture);
  const selectedAssets = selectAndOrderAssets(context);

  const numSamples = 10;
  const lookaheadSteps = Math.min(6, context.totalTimesteps - context.currentTimestep);

  // Sample scenarios to estimate expected performance
  let targetMultiplier = 1.0;

  switch (subtype) {
    case 'expected_value':
      // Sample drop-off scenarios and aim for expected value
      let expectedDropoffs = 0;
      for (let s = 0; s < numSamples; s++) {
        for (let t = 0; t < lookaheadSteps; t++) {
          if (Math.random() < context.config.noncompliance.probability) {
            expectedDropoffs++;
          }
        }
      }
      expectedDropoffs /= numSamples;
      // Increase target to compensate for expected dropoffs
      targetMultiplier = 1 + (expectedDropoffs / selectedAssets.length) * 0.5;
      break;

    case 'chance_constrained':
      // Aim to hit target with 95% probability
      // Increase reserve to handle variance
      targetMultiplier = 1 + riskParams.reserveMargin * 1.5;
      break;

    case 'monte_carlo_weighted':
      // Weight dispatch by simulation results
      const outcomes: number[] = [];
      for (let s = 0; s < numSamples; s++) {
        let sampleCapacity = 0;
        for (const sa of selectedAssets) {
          if (Math.random() > context.config.noncompliance.probability) {
            sampleCapacity += sa.capacity;
          }
        }
        outcomes.push(sampleCapacity);
      }
      // Use median outcome as target
      outcomes.sort((a, b) => a - b);
      const medianCapacity = outcomes[Math.floor(outcomes.length / 2)];
      if (medianCapacity > 0) {
        targetMultiplier = context.targetKw / medianCapacity;
      }
      break;
  }

  const effectiveTarget = adjustTargetForObjective(context, context.targetKw) * targetMultiplier;
  return dispatchToTarget(selectedAssets, effectiveTarget, context, riskParams);
}

// --- Feedback Control ---

function feedbackControlDispatch(context: StrategyContext): DispatchCommand[] {
  const subtype = context.strategyConfig.frameworkSubtype;
  const riskParams = getRiskParams(context.strategyConfig.riskPosture);
  const selectedAssets = selectAndOrderAssets(context);

  let effectiveTarget = adjustTargetForObjective(context, context.targetKw);

  if (context.previousAchievedKw !== null) {
    const error = context.targetKw - context.previousAchievedKw;

    switch (subtype) {
      case 'error_correction':
        // Proportional response to error
        effectiveTarget = context.targetKw + error * 1.5;
        break;

      case 'adaptive_weighting':
        // Adjust target and update asset weights based on performance
        effectiveTarget = context.targetKw + error;
        // (Asset weight updates would be tracked in assetPerformanceScores)
        break;

      case 'pid_like_control':
        // PID-like control with proportional, integral, and derivative terms
        const Kp = 1.2;  // Proportional gain
        const Ki = 0.1;  // Integral gain
        const Kd = 0.3;  // Derivative gain

        const integral = context.accumulatedError + error;
        const derivative = context.previousAchievedKw !== null
          ? error - (context.targetKw - context.previousAchievedKw)
          : 0;

        const correction = Kp * error + Ki * integral + Kd * derivative;
        effectiveTarget = context.targetKw + correction;
        break;
    }
  }

  // Clamp effective target to reasonable bounds
  effectiveTarget = Math.max(0, Math.min(effectiveTarget, context.targetKw * 2));

  return dispatchToTarget(selectedAssets, effectiveTarget, context, riskParams);
}

// ============================================
// DISPATCH COMMAND GENERATION
// ============================================

function dispatchToTarget(
  assets: ScoredAsset[],
  targetKw: number,
  context: StrategyContext,
  riskParams: RiskPostureParams
): DispatchCommand[] {
  const commands: DispatchCommand[] = [];
  let remainingTarget = targetKw;

  for (const { asset, capacity } of assets) {
    if (remainingTarget <= 0) break;

    // Get intensity for this asset type (0-100)
    const intensity = context.dispatchIntensity[asset.type] ?? 50;

    // Intensity affects how much of the capacity we're willing to use
    // At 0 intensity: use 50% of capacity max
    // At 50 intensity: use 100% of capacity
    // At 100 intensity: use 100% of capacity (no boost, just priority)
    const capacityMultiplier = 0.5 + (intensity / 100) * 0.5;
    const effectiveCapacity = capacity * capacityMultiplier;

    const dispatchAmount = Math.min(effectiveCapacity, remainingTarget);
    const command = createDispatchCommand(asset, dispatchAmount, riskParams, intensity);

    if (command) {
      commands.push(command);
      remainingTarget -= getCommandContribution(asset, command, riskParams);
    }
  }

  return commands;
}

function createDispatchCommand(
  asset: Asset,
  targetKw: number,
  riskParams: RiskPostureParams,
  intensity: number = 50  // 0-100, default to 50
): DispatchCommand | null {
  // Combine risk posture conservation with intensity
  // Higher intensity = less conservation (more aggressive)
  // intensityFactor: 0 at intensity=0, 0.5 at intensity=50, 1 at intensity=100
  const intensityFactor = intensity / 100;
  // Effective conservation: multiply risk posture by inverse of intensity
  // At intensity 100: conservation reduced by 50%
  // At intensity 0: conservation increased by 50%
  const conservationFactor = riskParams.conservationFactor * (1.5 - intensityFactor);

  switch (asset.type) {
    case 'battery_resi': {
      const bat = asset as BatteryResi;
      const effectiveReserve = bat.params.soc_reserve * (1 + conservationFactor * 0.3);
      const availSoc = bat.state.soc - effectiveReserve;
      const maxPower = Math.min(bat.params.p_dis_kw, availSoc * bat.params.e_kwh * 12);
      const power = Math.min(targetKw, maxPower);
      return {
        asset_id: asset.id,
        command: { type: 'battery', power_kw: Math.max(0, power) },
      };
    }

    case 'hvac_resi': {
      const hvac = asset as HvacResi;
      // Map target to setpoint shift (0-3 degrees based on intensity)
      // Higher intensity = larger max shift
      const maxShift = (1 + intensityFactor * 2) * (1 - conservationFactor * 0.3);
      const shift = hvac.params.mode === 'cooling'
        ? Math.min(maxShift, targetKw / hvac.params.hvac_kw * 2)
        : -Math.min(maxShift, targetKw / hvac.params.hvac_kw * 2);
      return {
        asset_id: asset.id,
        command: { type: 'hvac', delta_setpoint_f: Math.round(shift) },
      };
    }

    case 'ev_resi': {
      const ev = asset as EvResi;
      if (!ev.state.plugged || ev.state.override_active) return null;
      // Reduce charging rate to shift load
      // Higher intensity = willing to reduce more
      const maxReduction = ev.params.p_max_kw * (0.5 + intensityFactor * 0.5);
      const reduction = Math.min(maxReduction, targetKw);
      const newChargeRate = ev.params.p_max_kw - reduction;
      return {
        asset_id: asset.id,
        command: { type: 'ev', power_kw: Math.max(0, newChargeRate) },
      };
    }

    case 'fleet_site': {
      const fleet = asset as FleetSite;
      // Cap site power to reduce load
      // Higher intensity = willing to cap more aggressively
      const maxReduction = fleet.params.u_site_max_kw * (0.4 + intensityFactor * 0.4);
      const reduction = Math.min(maxReduction, targetKw);
      const capPower = fleet.params.u_site_max_kw - reduction;
      return {
        asset_id: asset.id,
        command: { type: 'fleet', site_power_cap_kw: Math.max(0, capPower) },
      };
    }

    case 'ci_building': {
      const ci = asset as CiBuilding;
      const availableHvac = ci.params.smax_hvac_kw * Math.exp(-ci.params.fatigue_k * ci.state.fatigue);
      const shedAmount = Math.min(availableHvac, targetKw) * (1 - conservationFactor * 0.3);
      const remainingForProcess = targetKw - shedAmount;
      // Higher intensity = more willing to curtail process
      const curtailProcess = remainingForProcess > 0 && ci.state.process_on && intensityFactor > 0.4;
      return {
        asset_id: asset.id,
        command: {
          type: 'ci_building',
          hvac_shed_kw: shedAmount,
          process_on: !curtailProcess,
        },
      };
    }

    default:
      return null;
  }
}

function getCommandContribution(
  asset: Asset,
  command: DispatchCommand,
  riskParams: RiskPostureParams
): number {
  switch (asset.type) {
    case 'battery_resi':
      return (command.command as { power_kw: number }).power_kw;
    case 'hvac_resi': {
      const hvac = asset as HvacResi;
      const shift = Math.abs((command.command as { delta_setpoint_f: number }).delta_setpoint_f);
      return hvac.params.hvac_kw * shift / 2;
    }
    case 'ev_resi': {
      const ev = asset as EvResi;
      const chargeRate = (command.command as { power_kw: number }).power_kw;
      return ev.params.p_max_kw - chargeRate;
    }
    case 'fleet_site': {
      const fleet = asset as FleetSite;
      const cap = (command.command as { site_power_cap_kw: number }).site_power_cap_kw;
      return fleet.params.u_site_max_kw - cap;
    }
    case 'ci_building': {
      const ci = asset as CiBuilding;
      const cmd = command.command as { hvac_shed_kw: number; process_on: boolean };
      let contribution = cmd.hvac_shed_kw;
      if (!cmd.process_on && ci.state.process_on) {
        contribution += ci.params.process_load_kw;
      }
      return contribution;
    }
    default:
      return 0;
  }
}

function maintainPreviousDispatch(
  context: StrategyContext,
  assets: ScoredAsset[]
): DispatchCommand[] {
  const riskParams = getRiskParams(context.strategyConfig.riskPosture);
  const commands: DispatchCommand[] = [];

  for (const { asset } of assets) {
    if (context.previouslyDispatchedAssetIds.has(asset.id)) {
      // Re-dispatch previously dispatched assets at same level
      const capacity = getAvailableCapacity(asset, context.currentTimestep);
      const command = createDispatchCommand(asset, capacity * 0.5, riskParams);
      if (command) {
        commands.push(command);
      }
    }
  }

  return commands;
}

// ============================================
// MAIN DISPATCH EXECUTOR
// ============================================

export function executeComposableStrategy(context: StrategyContext): DispatchCommand[] {
  const framework = context.strategyConfig.decisionFramework;

  switch (framework) {
    case 'deterministic_policy':
      return deterministicDispatch(context);
    case 'greedy_myopic':
      return greedyDispatch(context);
    case 'stochastic':
      return stochasticDispatch(context);
    case 'feedback_control':
      return feedbackControlDispatch(context);
    default:
      // Fallback to feedback control
      return feedbackControlDispatch(context);
  }
}

// ============================================
// STRATEGY INFO FOR UI
// ============================================

export const STRATEGY_INFO: Record<DecisionFramework, { name: string; description: string }> = {
  deterministic_policy: {
    name: 'Deterministic Policy',
    description: 'Fixed or state-dependent rules. Predictable and auditable dispatch behavior.',
  },
  greedy_myopic: {
    name: 'Greedy/Myopic',
    description: 'Optimizes immediate objective without long-horizon planning. Fast decisions.',
  },
  stochastic: {
    name: 'Stochastic',
    description: 'Explicitly models uncertainty and expected distributions. Robust to variability.',
  },
  feedback_control: {
    name: 'Feedback Control',
    description: 'Closed-loop control using real-time error correction. Adaptive to actual performance.',
  },
};

// Legacy strategy info for backward compatibility with existing screens
import { DispatchStrategy } from './types';

export const LEGACY_STRATEGY_INFO: Record<DispatchStrategy, { name: string; description: string }> = {
  rule_based: {
    name: 'Rule-Based',
    description: 'Follows a configurable priority order with moderate dispatch levels.',
  },
  greedy: {
    name: 'Greedy',
    description: 'Maximizes kW reduction by dispatching assets based on capacity or risk.',
  },
  stochastic: {
    name: 'Stochastic',
    description: 'Uses Monte Carlo sampling to account for uncertainty.',
  },
};

// ============================================
// DEFAULT CONTEXT FACTORY
// ============================================

export function createDefaultStrategyContext(
  assets: Asset[],
  targetKw: number,
  currentTimestep: number,
  totalTimesteps: number,
  config: ScenarioConfig,
  strategyConfig: StrategyConfig = DEFAULT_STRATEGY_CONFIG,
  dispatchIntensity: DispatchIntensitySettings = DEFAULT_DISPATCH_INTENSITY
): StrategyContext {
  return {
    assets,
    targetKw,
    currentTimestep,
    totalTimesteps,
    config,
    strategyConfig,
    dispatchIntensity,
    previousAchievedKw: null,
    previouslyDispatchedAssetIds: new Set(),
    accumulatedError: 0,
    assetPerformanceScores: new Map(),
  };
}
