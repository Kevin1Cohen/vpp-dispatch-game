// ============================================
// VPP Simulation Game - Simulation Engine
// Main loop and state management
// ============================================

import {
  Scenario,
  Asset,
  SimulationState,
  TimestepResult,
  DispatchStrategy,
  SubStrategy,
  AggressivenessSettings,
  AssetType,
  DispatchCommand,
  DEFAULT_AGGRESSIVENESS,
  EnhancedFinalScore,
  AssetTypePerformance,
  ASSET_TYPE_INFO,
  DifficultyLevel,
  DIFFICULTY_PRESETS,
  StrategyConfig,
  DEFAULT_STRATEGY_CONFIG,
  RiskPosture,
} from './types';
import { updateAsset } from './AssetModels';
import { executeComposableStrategy, StrategyContext } from './DispatchStrategies';

// ---------- Simulation Engine ----------

export class SimulationEngine {
  private state: SimulationState;
  private strategyConfig: StrategyConfig;
  private difficulty: DifficultyLevel;
  private onUpdate: (state: SimulationState) => void;
  private onComplete: (state: SimulationState) => void;
  private animationFrameId: number | null = null;
  private lastUpdateTime: number = 0;
  private speedMultiplier: number = 1;
  private baseStepDuration: number = 1000; // 1 second per timestep at 1x
  private previouslyDispatchedAssets: Set<string> = new Set(); // Track assets dispatched in previous timestep
  private accumulatedError: number = 0; // For PID-like feedback control
  private assetPerformanceScores: Map<string, number> = new Map(); // For adaptive weighting

  constructor(
    scenario: Scenario,
    strategyConfig: StrategyConfig,
    difficulty: DifficultyLevel,
    onUpdate: (state: SimulationState) => void,
    onComplete: (state: SimulationState) => void
  ) {
    this.strategyConfig = { ...strategyConfig };
    this.difficulty = difficulty;
    this.onUpdate = onUpdate;
    this.onComplete = onComplete;

    // Deep clone assets to avoid mutation
    const clonedAssets = JSON.parse(JSON.stringify(scenario.assets)) as Asset[];

    // Initialize performance scores for all assets
    for (const asset of clonedAssets) {
      this.assetPerformanceScores.set(asset.id, 0.5); // Start at neutral
    }

    this.state = {
      scenario,
      current_timestep: 0,
      assets: clonedAssets,
      history: [],
      total_penalty: 0,
      is_running: false,
      is_complete: false,
    };
  }

  // ---------- Control Methods ----------

  start(): void {
    if (this.state.is_complete) return;
    this.state.is_running = true;
    this.lastUpdateTime = performance.now();
    this.tick();
  }

  pause(): void {
    this.state.is_running = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  setSpeed(multiplier: number): void {
    this.speedMultiplier = Math.max(0.5, Math.min(10, multiplier));
  }

  // Update risk posture (replaces old aggressiveness)
  updateRiskPosture(riskPosture: RiskPosture): void {
    this.strategyConfig.riskPosture = riskPosture;
  }

  // Update entire strategy config
  updateStrategyConfig(config: Partial<StrategyConfig>): void {
    this.strategyConfig = { ...this.strategyConfig, ...config };
  }

  reset(): void {
    this.pause();
    const scenario = this.state.scenario;
    const clonedAssets = JSON.parse(JSON.stringify(scenario.assets)) as Asset[];

    // Reset performance scores
    this.assetPerformanceScores.clear();
    for (const asset of clonedAssets) {
      this.assetPerformanceScores.set(asset.id, 0.5);
    }

    this.state = {
      scenario,
      current_timestep: 0,
      assets: clonedAssets,
      history: [],
      total_penalty: 0,
      is_running: false,
      is_complete: false,
    };
    this.previouslyDispatchedAssets = new Set(); // Clear previous dispatch tracking
    this.accumulatedError = 0; // Reset accumulated error
    this.onUpdate(this.getState());
  }

  getState(): SimulationState {
    return { ...this.state };
  }

  // ---------- Main Loop ----------

  private tick = (): void => {
    if (!this.state.is_running || this.state.is_complete) return;

    const now = performance.now();
    const elapsed = now - this.lastUpdateTime;
    const stepDuration = this.baseStepDuration / this.speedMultiplier;

    if (elapsed >= stepDuration) {
      this.advanceTimestep();
      this.lastUpdateTime = now;
      this.onUpdate(this.getState());

      if (this.state.is_complete) {
        this.onComplete(this.getState());
        return;
      }
    }

    this.animationFrameId = requestAnimationFrame(this.tick);
  };

  private advanceTimestep(): void {
    const config = this.state.scenario.scenario;
    const timestep = this.state.current_timestep;

    // Check completion
    if (timestep >= config.timesteps) {
      this.state.is_complete = true;
      this.state.is_running = false;
      return;
    }

    // Get target kW
    const targetKw = config.objective.target_kw ?? 0;

    // Get outdoor temperature
    const outdoorTemp = config.weather.outdoor_temp_f[timestep] ?? 75;

    // Get start hour from scenario time
    const startDate = new Date(config.start_time);
    const startHour = startDate.getHours();

    // Get previous achieved kW for feedback (null on first timestep)
    const previousResult = this.state.history.length > 0
      ? this.state.history[this.state.history.length - 1]
      : null;
    const previousAchievedKw = previousResult?.achieved_kw ?? null;

    // Update accumulated error for PID control
    if (previousAchievedKw !== null) {
      const error = targetKw - previousAchievedKw;
      this.accumulatedError += error;
      // Clamp accumulated error to prevent windup
      this.accumulatedError = Math.max(-targetKw * 5, Math.min(targetKw * 5, this.accumulatedError));
    }

    // Execute composable dispatch strategy
    const context: StrategyContext = {
      assets: this.state.assets,
      targetKw,
      currentTimestep: timestep,
      totalTimesteps: config.timesteps,
      config,
      strategyConfig: this.strategyConfig,
      previousAchievedKw,
      previouslyDispatchedAssetIds: this.previouslyDispatchedAssets,
      accumulatedError: this.accumulatedError,
      assetPerformanceScores: this.assetPerformanceScores,
    };
    const commands = executeComposableStrategy(context);

    // Build asset map for fast lookup (needed for dispatch counting)
    const assetMap = new Map<string, Asset>();
    for (const asset of this.state.assets) {
      assetMap.set(asset.id, asset);
    }

    // Build command map and count dispatches by asset type
    const commandMap = new Map<string, DispatchCommand>();
    const dispatchesByType: Record<AssetType, number> = {
      hvac_resi: 0,
      battery_resi: 0,
      ev_resi: 0,
      fleet_site: 0,
      ci_building: 0,
    };
    const newDispatchCalls: Record<AssetType, number> = {
      hvac_resi: 0,
      battery_resi: 0,
      ev_resi: 0,
      fleet_site: 0,
      ci_building: 0,
    };

    // Track currently dispatched assets for next timestep comparison
    const currentlyDispatchedAssets = new Set<string>();

    for (const cmd of commands) {
      commandMap.set(cmd.asset_id, cmd);
      currentlyDispatchedAssets.add(cmd.asset_id);

      // Use asset map for O(1) lookup instead of O(n) find
      const asset = assetMap.get(cmd.asset_id);
      if (asset) {
        dispatchesByType[asset.type]++;

        // Check if this is a NEW dispatch (wasn't dispatched in previous timestep)
        if (!this.previouslyDispatchedAssets.has(cmd.asset_id)) {
          newDispatchCalls[asset.type]++;
        }
      }
    }

    // Update previous dispatches for next timestep
    this.previouslyDispatchedAssets = currentlyDispatchedAssets;

    // Get difficulty settings for response variability and penalty curve
    const difficultySettings = DIFFICULTY_PRESETS[this.difficulty];
    const responseVariability = difficultySettings.response_variability;
    const penaltyExponent = difficultySettings.penalty_exponent;

    // Update all assets and calculate achieved kW
    let achievedKw = 0;
    const updatedAssets: Asset[] = [];

    for (const asset of this.state.assets) {
      const cmd = commandMap.get(asset.id);
      const result = updateAsset(
        asset,
        cmd?.command ?? null,
        timestep,
        outdoorTemp,
        startHour,
        config
      );
      updatedAssets.push(result.asset);

      // Apply response variability - assets don't always deliver exactly what's expected
      // Variability is a random multiplier: 1 ± (variability * random)
      const variabilityFactor = 1 + (Math.random() * 2 - 1) * responseVariability;
      achievedKw += result.powerDelta * variabilityFactor;
    }

    this.state.assets = updatedAssets;

    // Update asset performance scores for adaptive weighting
    // Assets that performed well (didn't drop) get higher scores
    for (const asset of updatedAssets) {
      const currentScore = this.assetPerformanceScores.get(asset.id) ?? 0.5;
      const wasDispatched = currentlyDispatchedAssets.has(asset.id);

      if (wasDispatched) {
        if (asset.state.dropped) {
          // Asset dropped - decrease score
          this.assetPerformanceScores.set(asset.id, Math.max(0, currentScore - 0.1));
        } else {
          // Asset performed - increase score slightly
          this.assetPerformanceScores.set(asset.id, Math.min(1, currentScore + 0.02));
        }
      }
    }

    // Calculate shortfall (for display) and penalty using difficulty-based exponent
    // Penalty applies to both under AND over performance, but ASYMMETRICALLY:
    // - Under-performance (missing target) is penalized at full rate
    // - Over-performance is penalized at a reduced rate based on difficulty
    // This mimics real-world operations where missing commitment is worse than exceeding it
    const shortfall = Math.max(0, targetKw - achievedKw);
    const deviation = Math.abs(targetKw - achievedKw);
    const isOverPerformance = achievedKw > targetKw;
    const overPerformanceRatio = difficultySettings.over_performance_penalty_ratio;
    const epsilon = 0.001;
    const normalizedDeviation = deviation / (targetKw + epsilon);

    // Apply asymmetric penalty: over-performance gets a reduced penalty
    const basePenalty = Math.pow(normalizedDeviation, penaltyExponent);
    const penalty = isOverPerformance ? basePenalty * overPerformanceRatio : basePenalty;

    // Count dropped assets
    const droppedCount = updatedAssets.filter(a => a.state.dropped).length;

    // Format time string
    const currentTime = new Date(startDate.getTime() + timestep * 5 * 60 * 1000);
    const timeString = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Record result
    const result: TimestepResult = {
      timestep,
      time: timeString,
      target_kw: targetKw,
      achieved_kw: Math.round(achievedKw * 10) / 10,
      shortfall_kw: Math.round(shortfall * 10) / 10,
      penalty: Math.round(penalty * 10000) / 10000,
      assets_dropped: droppedCount,
      outdoor_temp_f: Math.round(outdoorTemp * 10) / 10,
      dispatches_by_type: dispatchesByType,
      new_dispatch_calls: newDispatchCalls,
    };

    this.state.history.push(result);
    this.state.total_penalty += penalty;
    this.state.current_timestep++;
  }

  // Step forward one timestep manually
  step(): void {
    if (this.state.is_complete) return;
    this.advanceTimestep();
    this.onUpdate(this.getState());
    if (this.state.is_complete) {
      this.onComplete(this.getState());
    }
  }
}

// ---------- Helper Functions ----------

export function calculateFinalScore(state: SimulationState): {
  totalPenalty: number;
  averagePenalty: number;
  percentTargetMet: number;
  assetsDropped: number;
  grade: string;
} {
  const totalTimesteps = state.history.length;
  if (totalTimesteps === 0) {
    return {
      totalPenalty: 0,
      averagePenalty: 0,
      percentTargetMet: 100,
      assetsDropped: 0,
      grade: 'N/A',
    };
  }

  const totalTarget = state.history.reduce((sum, r) => sum + r.target_kw, 0);
  const totalAchieved = state.history.reduce((sum, r) => sum + r.achieved_kw, 0);
  const percentMet = totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 100;
  const avgPenalty = state.total_penalty / totalTimesteps;
  const assetsDropped = state.assets.filter(a => a.state.dropped).length;

  // Grade based on average penalty
  let grade: string;
  if (avgPenalty < 0.01) grade = 'A+';
  else if (avgPenalty < 0.03) grade = 'A';
  else if (avgPenalty < 0.05) grade = 'B+';
  else if (avgPenalty < 0.10) grade = 'B';
  else if (avgPenalty < 0.15) grade = 'C';
  else if (avgPenalty < 0.25) grade = 'D';
  else grade = 'F';

  return {
    totalPenalty: Math.round(state.total_penalty * 1000) / 1000,
    averagePenalty: Math.round(avgPenalty * 10000) / 10000,
    percentTargetMet: Math.round(percentMet * 10) / 10,
    assetsDropped,
    grade,
  };
}

export function formatDuration(timesteps: number): string {
  const totalMinutes = timesteps * 5;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else {
    return `${minutes}m`;
  }
}

// ---------- Enhanced Score Calculation ----------

export function calculateEnhancedFinalScore(state: SimulationState): EnhancedFinalScore {
  const totalTimesteps = state.history.length;
  const allAssetTypes: AssetType[] = ['hvac_resi', 'battery_resi', 'ev_resi', 'fleet_site', 'ci_building'];

  // Basic metrics
  const basicScore = calculateFinalScore(state);

  if (totalTimesteps === 0) {
    const emptyPerformance: AssetTypePerformance[] = allAssetTypes.map(assetType => ({
      assetType,
      totalDispatched: 0,
      totalDropped: 0,
      totalKwContributed: 0,
      avgKwPerTimestep: 0,
      complianceRate: 100,
    }));

    return {
      ...basicScore,
      totalKwShifted: 0,
      avgKwVsTarget: 0,
      totalAssetsPerformed: 0,
      totalAssetsDropped: 0,
      assetTypePerformance: emptyPerformance,
      mostDispatchedAssetType: 'hvac_resi',
      bestPerformingAssetType: 'hvac_resi',
      worstPerformingAssetType: 'hvac_resi',
    };
  }

  // Calculate total kW shifted (sum of all achieved kW)
  const totalKwShifted = state.history.reduce((sum, r) => sum + r.achieved_kw, 0);

  // Calculate avg kW vs target per timestep
  const avgAchieved = totalKwShifted / totalTimesteps;
  const avgTarget = state.history.reduce((sum, r) => sum + r.target_kw, 0) / totalTimesteps;
  const avgKwVsTarget = avgAchieved - avgTarget;

  // Count assets by type and dropped status
  const assetsByType = new Map<AssetType, { total: number; dropped: number }>();
  for (const assetType of allAssetTypes) {
    assetsByType.set(assetType, { total: 0, dropped: 0 });
  }

  for (const asset of state.assets) {
    const entry = assetsByType.get(asset.type)!;
    entry.total++;
    if (asset.state.dropped) {
      entry.dropped++;
    }
  }

  // Calculate per-asset-type performance
  // We'll estimate kW contribution based on asset type characteristics
  const assetTypePerformance: AssetTypePerformance[] = allAssetTypes.map(assetType => {
    const stats = assetsByType.get(assetType)!;
    const performed = stats.total - stats.dropped;

    // Estimate kW contribution based on asset type
    // This is a simplified model - in reality we'd track this during simulation
    let avgKwPerAsset = 0;
    switch (assetType) {
      case 'hvac_resi':
        avgKwPerAsset = 3.5; // Average HVAC load
        break;
      case 'battery_resi':
        avgKwPerAsset = 4.0; // Average battery discharge
        break;
      case 'ev_resi':
        avgKwPerAsset = 5.0; // L2 charger reduction
        break;
      case 'fleet_site':
        avgKwPerAsset = 75; // Fleet site reduction
        break;
      case 'ci_building':
        avgKwPerAsset = 50; // C&I building reduction
        break;
    }

    const estimatedKwContributed = performed * avgKwPerAsset * totalTimesteps * 0.7; // 70% utilization factor
    const complianceRate = stats.total > 0 ? ((stats.total - stats.dropped) / stats.total) * 100 : 100;

    return {
      assetType,
      totalDispatched: stats.total,
      totalDropped: stats.dropped,
      totalKwContributed: Math.round(estimatedKwContributed),
      avgKwPerTimestep: stats.total > 0 ? Math.round((estimatedKwContributed / totalTimesteps) * 10) / 10 : 0,
      complianceRate: Math.round(complianceRate * 10) / 10,
    };
  });

  // Find most dispatched asset type (by count)
  const activePerformance = assetTypePerformance.filter(p => p.totalDispatched > 0);
  const mostDispatchedAssetType = activePerformance.length > 0
    ? activePerformance.reduce((a, b) => a.totalDispatched > b.totalDispatched ? a : b).assetType
    : 'hvac_resi';

  // Find best performing (highest compliance rate among active assets)
  const bestPerformingAssetType = activePerformance.length > 0
    ? activePerformance.reduce((a, b) => a.complianceRate > b.complianceRate ? a : b).assetType
    : 'hvac_resi';

  // Find worst performing (lowest compliance rate among active assets)
  const worstPerformingAssetType = activePerformance.length > 0
    ? activePerformance.reduce((a, b) => a.complianceRate < b.complianceRate ? a : b).assetType
    : 'hvac_resi';

  // Total assets that performed vs dropped
  const totalAssetsPerformed = state.assets.filter(a => !a.state.dropped).length;
  const totalAssetsDropped = state.assets.filter(a => a.state.dropped).length;

  return {
    ...basicScore,
    totalKwShifted: Math.round(totalKwShifted),
    avgKwVsTarget: Math.round(avgKwVsTarget * 10) / 10,
    totalAssetsPerformed,
    totalAssetsDropped,
    assetTypePerformance,
    mostDispatchedAssetType,
    bestPerformingAssetType,
    worstPerformingAssetType,
  };
}
