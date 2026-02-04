// ============================================
// VPP Simulation Game - TypeScript Type Definitions
// Based on vpp_scenario_generator_schema.md
// ============================================

// ---------- Scenario-Level Types ----------

export interface Scenario {
  scenario: ScenarioConfig;
  assets: Asset[];
}

export interface ScenarioConfig {
  start_time: string; // ISO 8601 with timezone
  timesteps: number;
  weather: Weather;
  objective: Objective;
  baseline_error: BaselineError;
  measurement_noise: MeasurementNoise;
  noncompliance: Noncompliance;
}

export interface Weather {
  outdoor_temp_f: number[]; // Length = timesteps
}

export interface Objective {
  type: 'kw_target' | 'peak_cap' | 'mwh_delivery';
  target_kw?: number;
  target_mwh?: number;
  peak_cap_kw?: number;
}

export interface BaselineError {
  sigma_bias: number; // ~0.03 (3% std dev)
  sigma_drift: number; // ~0.01 (1% per step)
  rho: number; // 0.8 drift persistence
}

export interface MeasurementNoise {
  pct_uniform: number; // 0.05 = ±5%
}

export interface Noncompliance {
  probability: number; // 0.05-0.15
}

// ---------- Asset Types ----------

export type AssetType = 'hvac_resi' | 'battery_resi' | 'ev_resi' | 'fleet_site' | 'ci_building';

export type Asset = HvacResi | BatteryResi | EvResi | FleetSite | CiBuilding;

// ---------- Residential HVAC ----------

export interface HvacResi {
  id: string;
  type: 'hvac_resi';
  params: HvacResiParams;
  state: HvacResiState;
}

export interface HvacResiParams {
  mode: 'cooling' | 'heating';
  pref_setpoint_f: number; // 74°F for cooling, 70°F for heating
  comfort_max_f: number; // 78°F hard max for cooling
  comfort_min_f: number; // 66°F hard min for heating
  alpha: number; // Building leakage 0.03-0.08
  beta: number; // HVAC effectiveness ±0.3-0.7°F per step
  hvac_kw: number; // Power draw 2-6 kW
  deadband_f: number; // Thermostat hysteresis 0.5°F
}

export interface HvacResiState {
  tin_f: number; // Current indoor temperature
  hvac_on: boolean; // Is HVAC currently running
  setpoint_f: number; // Current setpoint
  dropped: boolean;
  baseline_bias: number; // Per-device bias
  baseline_drift: number; // Current drift value
}

// ---------- Residential Battery ----------

export interface BatteryResi {
  id: string;
  type: 'battery_resi';
  params: BatteryResiParams;
  state: BatteryResiState;
}

export interface BatteryResiParams {
  e_kwh: number; // Capacity 7-13.5 kWh
  p_dis_kw: number; // Max discharge power 3-5 kW
  p_ch_kw: number; // Max charge power 3-5 kW
  soc_reserve: number; // Minimum SOC floor 0.20
}

export interface BatteryResiState {
  soc: number; // State of charge [0, 1]
  dropped: boolean;
  baseline_bias: number;
  baseline_drift: number;
}

// ---------- Residential EV ----------

export interface EvResi {
  id: string;
  type: 'ev_resi';
  params: EvResiParams;
  state: EvResiState;
}

export interface EvResiParams {
  charger_level: 'L1' | 'L2';
  p_max_kw: number; // Max charging power
  e_req_kwh: number; // Required energy by departure
  e_capacity_kwh: number; // Battery capacity
  t_arrival: number; // Arrival timestep index
  t_depart: number; // Departure timestep index
}

export interface EvResiState {
  e_kwh: number; // Current battery energy
  plugged: boolean;
  dropped: boolean;
  override_active: boolean;
  baseline_bias: number;
  baseline_drift: number;
}

// ---------- Commercial Fleet Chargers ----------

export interface FleetSite {
  id: string;
  type: 'fleet_site';
  params: FleetSiteParams;
  state: FleetSiteState;
}

export interface FleetSiteParams {
  u_site_max_kw: number; // Max site power 50-300 kW
  vehicles: FleetVehicle[];
}

export interface FleetVehicle {
  id: string;
  p_max_kw: number;
  e_req_kwh: number;
  e_capacity_kwh: number;
  t_arrival: number;
  t_depart: number;
}

export interface FleetSiteState {
  vehicle_state: Record<string, FleetVehicleState>;
  dropped: boolean;
  baseline_bias: number;
  baseline_drift: number;
}

export interface FleetVehicleState {
  e_kwh: number;
  plugged: boolean;
}

// ---------- C&I Building ----------

export interface CiBuilding {
  id: string;
  type: 'ci_building';
  params: CiBuildingParams;
  state: CiBuildingState;
}

export interface CiBuildingParams {
  smax_hvac_kw: number; // Max HVAC shed 20-150 kW
  fatigue_k: number; // Fatigue-to-availability decay
  fatigue_a: number; // Fatigue increase coefficient
  fatigue_b: number; // Fatigue recovery coefficient
  process_load_kw: number; // Process load when ON
  max_process_toggles: number; // Max toggles per event
  business_hours: { start_hour: number; end_hour: number };
}

export interface CiBuildingState {
  fatigue: number; // Current fatigue level
  hvac_shed_kw: number; // Current HVAC shed
  process_on: boolean;
  process_toggles_used: number;
  dropped: boolean;
  baseline_bias: number;
  baseline_drift: number;
}

// ---------- Dispatch Commands ----------

export interface DispatchCommand {
  asset_id: string;
  command: AssetCommand;
}

export type AssetCommand =
  | HvacCommand
  | BatteryCommand
  | EvCommand
  | FleetCommand
  | CiBuildingCommand;

export interface HvacCommand {
  type: 'hvac';
  delta_setpoint_f: number; // -2 to +2
}

export interface BatteryCommand {
  type: 'battery';
  power_kw: number; // Negative = charge, positive = discharge
}

export interface EvCommand {
  type: 'ev';
  power_kw: number; // 0 to p_max_kw (charging rate)
}

export interface FleetCommand {
  type: 'fleet';
  site_power_cap_kw: number; // 0 to u_site_max_kw
}

export interface CiBuildingCommand {
  type: 'ci_building';
  hvac_shed_kw: number;
  process_on: boolean;
}

// ---------- Simulation State ----------

export interface SimulationState {
  scenario: Scenario;
  current_timestep: number;
  assets: Asset[];
  history: TimestepResult[];
  total_penalty: number;
  is_running: boolean;
  is_complete: boolean;
}

export interface TimestepResult {
  timestep: number;
  time: string; // Formatted time string
  target_kw: number;
  achieved_kw: number;
  shortfall_kw: number;
  penalty: number;
  assets_dropped: number;
  outdoor_temp_f: number;
}

// ---------- Game Configuration ----------

export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export type DispatchStrategy = 'rule_based' | 'greedy' | 'stochastic';

// Sub-strategies for each top-level strategy
export type RuleBasedSubStrategy = 'batteries_first' | 'hvac_first' | 'load_reduction_first' | 'balanced';
export type GreedySubStrategy = 'max_capacity' | 'lowest_risk' | 'efficiency_optimized';
export type StochasticSubStrategy = 'risk_averse' | 'opportunity_seeking' | 'deadline_aware';

export type SubStrategy = RuleBasedSubStrategy | GreedySubStrategy | StochasticSubStrategy;

// Aggressiveness settings per asset type (0-100)
export interface AggressivenessSettings {
  hvac_resi: number;
  battery_resi: number;
  ev_resi: number;
  fleet_site: number;
  ci_building: number;
}

export const DEFAULT_AGGRESSIVENESS: AggressivenessSettings = {
  hvac_resi: 50,
  battery_resi: 50,
  ev_resi: 50,
  fleet_site: 50,
  ci_building: 50,
};

export interface GameConfig {
  difficulty: DifficultyLevel;
  strategy: DispatchStrategy;
  subStrategy: SubStrategy;
  aggressiveness: AggressivenessSettings;
  asset_types: AssetType[];
  asset_counts: Record<AssetType, number>;
}

export interface GameScreen {
  type: 'welcome' | 'rules' | 'setup' | 'simulation' | 'results';
}

// ---------- Difficulty Presets ----------
// Asset counts are set to provide ~3x capacity vs target for strategic flexibility
// target_multiplier determines what fraction of max capacity becomes the target

export const DIFFICULTY_PRESETS: Record<DifficultyLevel, {
  total_assets: number;
  noncompliance: number;
  target_multiplier: number;
}> = {
  easy: {
    total_assets: 200,       // ~3x more assets for strategic choices
    noncompliance: 0.05,
    target_multiplier: 0.25, // Target = 25% of capacity (4x headroom)
  },
  medium: {
    total_assets: 400,       // Larger portfolio
    noncompliance: 0.10,
    target_multiplier: 0.30, // Target = 30% of capacity (~3.3x headroom)
  },
  hard: {
    total_assets: 600,       // Full-scale portfolio
    noncompliance: 0.15,
    target_multiplier: 0.33, // Target = 33% of capacity (3x headroom)
  },
};

// ---------- Asset Type Metadata ----------

export const ASSET_TYPE_INFO: Record<AssetType, {
  name: string;
  description: string;
  icon: string;
}> = {
  hvac_resi: {
    name: 'Residential HVAC',
    description: 'Home thermostats with comfort constraints',
    icon: '🏠',
  },
  battery_resi: {
    name: 'Home Battery',
    description: 'Residential energy storage systems',
    icon: '🔋',
  },
  ev_resi: {
    name: 'Residential EV',
    description: 'Electric vehicle chargers with departure deadlines',
    icon: '🚗',
  },
  fleet_site: {
    name: 'Fleet Chargers',
    description: 'Commercial vehicle charging depots',
    icon: '🚚',
  },
  ci_building: {
    name: 'C&I Building',
    description: 'Commercial/Industrial with HVAC and process loads',
    icon: '🏢',
  },
};

// ---------- Sub-Strategy Metadata ----------

export const RULE_BASED_SUB_STRATEGIES: Record<RuleBasedSubStrategy, {
  name: string;
  description: string;
}> = {
  batteries_first: {
    name: 'Batteries First',
    description: 'Prioritize battery discharge before other assets (best for short events)',
  },
  hvac_first: {
    name: 'HVAC First',
    description: 'Lead with thermostat adjustments (best for longer events, preserves battery)',
  },
  load_reduction_first: {
    name: 'Load Reduction First',
    description: 'Prioritize EV and Fleet charging reduction (minimal comfort impact)',
  },
  balanced: {
    name: 'Balanced',
    description: 'Equal weighting across all asset types',
  },
};

export const GREEDY_SUB_STRATEGIES: Record<GreedySubStrategy, {
  name: string;
  description: string;
}> = {
  max_capacity: {
    name: 'Max Capacity',
    description: 'Always dispatch highest-capacity assets first',
  },
  lowest_risk: {
    name: 'Lowest Risk',
    description: 'Prioritize assets least likely to drop off',
  },
  efficiency_optimized: {
    name: 'Efficiency Optimized',
    description: 'Prioritize assets with best kW-per-drop-risk ratio',
  },
};

export const STOCHASTIC_SUB_STRATEGIES: Record<StochasticSubStrategy, {
  name: string;
  description: string;
}> = {
  risk_averse: {
    name: 'Risk-Averse',
    description: 'Higher safety margins in Monte Carlo sampling',
  },
  opportunity_seeking: {
    name: 'Opportunity Seeking',
    description: 'Takes calculated risks for higher potential payoff',
  },
  deadline_aware: {
    name: 'Deadline Aware',
    description: 'Heavily weights time-remaining in dispatch decisions',
  },
};

// Helper to get sub-strategies for a given top-level strategy
export function getSubStrategiesForStrategy(strategy: DispatchStrategy): Record<string, { name: string; description: string }> {
  switch (strategy) {
    case 'rule_based':
      return RULE_BASED_SUB_STRATEGIES;
    case 'greedy':
      return GREEDY_SUB_STRATEGIES;
    case 'stochastic':
      return STOCHASTIC_SUB_STRATEGIES;
  }
}

// Get default sub-strategy for a top-level strategy
export function getDefaultSubStrategy(strategy: DispatchStrategy): SubStrategy {
  switch (strategy) {
    case 'rule_based':
      return 'balanced';
    case 'greedy':
      return 'max_capacity';
    case 'stochastic':
      return 'risk_averse';
  }
}

// ---------- Enhanced Final Score ----------

export interface AssetTypePerformance {
  assetType: AssetType;
  totalDispatched: number;
  totalDropped: number;
  totalKwContributed: number;
  avgKwPerTimestep: number;
  complianceRate: number; // percentage that didn't drop
}

export interface EnhancedFinalScore {
  // Basic metrics (existing)
  totalPenalty: number;
  averagePenalty: number;
  percentTargetMet: number;
  assetsDropped: number;
  grade: string;

  // New metrics
  totalKwShifted: number;
  avgKwVsTarget: number; // positive = over target, negative = under
  totalAssetsPerformed: number;
  totalAssetsDropped: number;

  // Per-asset-type breakdown
  assetTypePerformance: AssetTypePerformance[];

  // Strategy effectiveness
  mostDispatchedAssetType: AssetType;
  bestPerformingAssetType: AssetType;
  worstPerformingAssetType: AssetType;
}
