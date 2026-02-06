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
  dispatches_by_type: Record<AssetType, number>; // Total dispatch commands active per asset type
  new_dispatch_calls: Record<AssetType, number>; // NEW dispatch calls made this timestep (not ongoing)
}

// ---------- Game Configuration ----------

export type DifficultyLevel = 'easy' | 'medium' | 'hard';

// ============================================
// NEW STRATEGY TAXONOMY - Composable Dispatch System
// ============================================

// ---------- Decision Framework ----------
// How dispatch decisions are computed over time

export type DecisionFramework =
  | 'deterministic_policy'
  | 'greedy_myopic'
  | 'stochastic'
  | 'feedback_control';

export type DeterministicSubtype =
  | 'static_priority'      // Fixed ordering of assets
  | 'threshold_triggered'  // Dispatch when signals cross thresholds
  | 'state_machine'        // State-dependent rules across event phases
  | 'scenario_tree';       // Pre-defined contingency branches

export type GreedySubtype =
  | 'max_capacity_now'     // Maximize kW in current interval
  | 'min_risk_now'         // Minimize immediate drop-off probability
  | 'best_efficiency_now'; // Maximize kW per unit of estimated cost

export type StochasticSubtype =
  | 'expected_value'       // Optimize expected performance
  | 'chance_constrained'   // Meet constraints with high probability
  | 'monte_carlo_weighted'; // Simulation-based decision weighting

export type FeedbackSubtype =
  | 'error_correction'     // Adjust dispatch based on deviation from target
  | 'adaptive_weighting'   // Continuously reweight assets by performance
  | 'pid_like_control';    // Control-theoretic response for fast assets

export type FrameworkSubtype = DeterministicSubtype | GreedySubtype | StochasticSubtype | FeedbackSubtype;

// ---------- Objective Function ----------
// What the strategy is optimizing for

export type ObjectiveFunction =
  | 'capacity'             // Maximize probability of meeting MW obligation
  | 'risk_minimization'    // Minimize variance and probability of failure
  | 'efficiency'           // Maximize value per unit of customer/asset cost
  | 'regret_minimization'  // Avoid worst-case or reputationally damaging outcomes
  | 'learning_oriented';   // Improve future dispatch by reducing uncertainty

// ---------- Selection and Ordering ----------
// How assets are selected and ordered for dispatch

export type SelectionCategory =
  | 'asset_type_based'
  | 'performance_based'
  | 'state_based'
  | 'fairness_based';

export type AssetTypeOrdering =
  | 'batteries_first'
  | 'hvac_first'
  | 'high_load_reduction_first'
  | 'balanced_weighting';

export type PerformanceOrdering =
  | 'highest_trust_score'
  | 'lowest_variance'
  | 'best_historical_delivery';

export type StateOrdering =
  | 'highest_headroom'
  | 'lowest_marginal_comfort_cost'
  | 'highest_soc_buffer';

export type FairnessOrdering =
  | 'least_recently_dispatched'
  | 'round_robin'
  | 'fatigue_balanced';

export type SelectionOrdering = AssetTypeOrdering | PerformanceOrdering | StateOrdering | FairnessOrdering;

// ---------- Risk Posture ----------
// How aggressively the strategy trades risk for value

export type RiskPosture =
  | 'risk_averse'          // High reserves, conservative dispatch
  | 'neutral'              // Balanced risk and reward
  | 'opportunity_seeking'  // Calculated risk for higher upside
  | 'deadline_aware';      // Aggressiveness increases as time remaining shrinks

// ---------- Feedback Mode ----------
// How the system adapts during events

export type FeedbackMode =
  | 'none'                 // No adaptation during event
  | 'closed_loop'          // Adjust dispatch based on observed performance
  | 'post_event_learning'; // Update models after events (future use)

// ---------- Composed Strategy Configuration ----------

export interface StrategyConfig {
  // Required: One decision framework
  decisionFramework: DecisionFramework;
  frameworkSubtype: FrameworkSubtype;

  // Required: One objective function
  objective: ObjectiveFunction;

  // Required: One or more selection orderings (hybrid allowed)
  selectionOrderings: SelectionOrdering[];

  // Required: One risk posture
  riskPosture: RiskPosture;

  // Required: Feedback mode
  feedbackMode: FeedbackMode;
}

// ---------- Risk Posture Parameters ----------
// Numerical parameters derived from risk posture selection

export interface RiskPostureParams {
  reserveMargin: number;        // 0.1 to 0.5 - extra capacity to hold back
  dispatchTiming: number;       // -1 to 1: negative = early, positive = delayed
  rampUpSpeed: number;          // 0.3 to 0.8 - initial percentage of assets
  conservationFactor: number;   // 0.2 to 0.8 - how conservative in uncertainty
}

export const RISK_POSTURE_PARAMS: Record<RiskPosture, RiskPostureParams> = {
  risk_averse: {
    reserveMargin: 0.4,
    dispatchTiming: -0.5,    // Early dispatch
    rampUpSpeed: 0.3,        // Start with 30%
    conservationFactor: 0.7, // Very conservative
  },
  neutral: {
    reserveMargin: 0.25,
    dispatchTiming: 0,
    rampUpSpeed: 0.5,        // Start with 50%
    conservationFactor: 0.5,
  },
  opportunity_seeking: {
    reserveMargin: 0.15,
    dispatchTiming: 0.3,     // Slightly delayed
    rampUpSpeed: 0.6,        // Start with 60%
    conservationFactor: 0.3, // More aggressive
  },
  deadline_aware: {
    reserveMargin: 0.35,     // Moderate reserves early
    dispatchTiming: 0,       // Timing varies with event progress
    rampUpSpeed: 0.25,       // Start conservative
    conservationFactor: 0.6, // Starts conservative, becomes aggressive
  },
};

// ---------- Default Strategy Configuration ----------

export const DEFAULT_STRATEGY_CONFIG: StrategyConfig = {
  decisionFramework: 'feedback_control',
  frameworkSubtype: 'error_correction',
  objective: 'capacity',
  selectionOrderings: ['balanced_weighting', 'highest_headroom'],
  riskPosture: 'neutral',
  feedbackMode: 'closed_loop',
};

// ---------- Legacy Types (kept for compatibility during transition) ----------

export type DispatchStrategy = 'rule_based' | 'greedy' | 'stochastic';
export type RuleBasedSubStrategy = 'batteries_first' | 'hvac_first' | 'load_reduction_first' | 'balanced';
export type GreedySubStrategy = 'max_capacity' | 'lowest_risk' | 'efficiency_optimized';
export type StochasticSubStrategy = 'risk_averse' | 'opportunity_seeking' | 'deadline_aware';
export type SubStrategy = RuleBasedSubStrategy | GreedySubStrategy | StochasticSubStrategy;

// Legacy aggressiveness (replaced by RiskPosture + selection orderings)
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

// ---------- Game Config (Updated) ----------

export interface GameConfig {
  difficulty: DifficultyLevel;
  // New composable strategy system
  strategyConfig: StrategyConfig;
  // Legacy fields (deprecated but kept for compatibility)
  strategy: DispatchStrategy;
  subStrategy: SubStrategy;
  aggressiveness: AggressivenessSettings;
  // Asset configuration
  asset_types: AssetType[];
  asset_counts: Record<AssetType, number>;
}

export interface GameScreen {
  type: 'welcome' | 'rules' | 'setup' | 'simulation' | 'results';
}

// ---------- Difficulty Presets ----------
// VPP targeting 5 MW (Easy) to 300 MW (Hard)
// Difficulty is based on:
// - target_mw: The MW target for the event
// - noncompliance: Probability of random asset dropoffs
// - response_variability: How unpredictable asset kW delivery is (0-1)
// - headroom_multiplier: How much extra capacity vs target (for strategic flexibility)
// - penalty_exponent: Steeper curve = harsher penalties for deviation

export const DIFFICULTY_PRESETS: Record<DifficultyLevel, {
  target_mw: number;
  noncompliance: number;
  response_variability: number;
  headroom_multiplier: number;
  penalty_exponent: number;
  over_performance_penalty_ratio: number;  // Ratio of over-performance penalty vs under-performance (0-1)
}> = {
  easy: {
    target_mw: 5,               // 5 MW target
    noncompliance: 0.05,        // 5% random dropoffs
    response_variability: 0.1,  // Assets respond fairly predictably
    headroom_multiplier: 4.0,   // 4x headroom (20 MW capacity for 5 MW target)
    penalty_exponent: 1.5,      // Gentle penalty curve
    over_performance_penalty_ratio: 0.3,  // Over-performance penalized at 30% of under (most forgiving)
  },
  medium: {
    target_mw: 50,              // 50 MW target
    noncompliance: 0.15,        // 15% random dropoffs
    response_variability: 0.25, // Moderate unpredictability
    headroom_multiplier: 2.5,   // 2.5x headroom (125 MW capacity for 50 MW target)
    penalty_exponent: 2.0,      // Standard quadratic penalty
    over_performance_penalty_ratio: 0.5,  // Over-performance penalized at 50% of under (mild asymmetry)
  },
  hard: {
    target_mw: 300,             // 300 MW target
    noncompliance: 0.25,        // 25% random dropoffs
    response_variability: 0.4,  // High unpredictability in responses
    headroom_multiplier: 1.5,   // 1.5x headroom (450 MW capacity for 300 MW target)
    penalty_exponent: 3.0,      // Steep penalty curve - every MW matters
    over_performance_penalty_ratio: 0.7,  // Over-performance penalized at 70% of under (less forgiving)
  },
};

// ---------- Asset Type Capacity ----------
// Realistic average kW contribution per asset type
export const ASSET_AVG_KW: Record<AssetType, number> = {
  hvac_resi: 4,       // 4 kW average residential HVAC
  battery_resi: 5,    // 5 kW average home battery
  ev_resi: 7,         // 7 kW average EV charger (L2)
  fleet_site: 150,    // 150 kW average fleet charging site
  ci_building: 200,   // 200 kW average C&I building load shed
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

// ============================================
// STRATEGY TAXONOMY METADATA
// ============================================

// ---------- Decision Framework Metadata ----------

export const DECISION_FRAMEWORK_INFO: Record<DecisionFramework, {
  name: string;
  description: string;
  subtypes: Record<string, { name: string; description: string }>;
}> = {
  deterministic_policy: {
    name: 'Deterministic Policy',
    description: 'Fixed or state-dependent rules. Predictable and auditable dispatch behavior.',
    subtypes: {
      static_priority: {
        name: 'Static Priority',
        description: 'Fixed ordering of assets by type or characteristics. Simple and predictable.',
      },
      threshold_triggered: {
        name: 'Threshold Triggered',
        description: 'Dispatch assets when performance signals cross defined thresholds.',
      },
      state_machine: {
        name: 'State Machine',
        description: 'Different dispatch rules for different event phases (ramp, sustain, recovery).',
      },
      scenario_tree: {
        name: 'Scenario Tree',
        description: 'Pre-defined contingency branches based on event conditions.',
      },
    },
  },
  greedy_myopic: {
    name: 'Greedy/Myopic',
    description: 'Optimizes immediate objective without long-horizon planning. Fast decisions.',
    subtypes: {
      max_capacity_now: {
        name: 'Max Capacity Now',
        description: 'Maximize kW delivery in the current interval regardless of future impact.',
      },
      min_risk_now: {
        name: 'Min Risk Now',
        description: 'Minimize immediate drop-off probability. Prioritize reliable assets.',
      },
      best_efficiency_now: {
        name: 'Best Efficiency Now',
        description: 'Maximize kW per unit of estimated customer/asset cost.',
      },
    },
  },
  stochastic: {
    name: 'Stochastic',
    description: 'Explicitly models uncertainty and expected distributions. Robust to variability.',
    subtypes: {
      expected_value: {
        name: 'Expected Value',
        description: 'Optimize expected (average) performance across simulated scenarios.',
      },
      chance_constrained: {
        name: 'Chance Constrained',
        description: 'Meet performance constraints with high probability (e.g., 95% confidence).',
      },
      monte_carlo_weighted: {
        name: 'Monte Carlo Weighted',
        description: 'Weight decisions by simulation results across many random samples.',
      },
    },
  },
  feedback_control: {
    name: 'Feedback Control',
    description: 'Closed-loop control using real-time error correction. Adaptive to actual performance.',
    subtypes: {
      error_correction: {
        name: 'Error Correction',
        description: 'Adjust dispatch based on deviation between target and achieved kW.',
      },
      adaptive_weighting: {
        name: 'Adaptive Weighting',
        description: 'Continuously reweight assets based on their real-time performance.',
      },
      pid_like_control: {
        name: 'PID-like Control',
        description: 'Control-theoretic response with proportional, integral, and derivative terms.',
      },
    },
  },
};

// ---------- Objective Function Metadata ----------

export const OBJECTIVE_FUNCTION_INFO: Record<ObjectiveFunction, {
  name: string;
  description: string;
  metrics: string[];
}> = {
  capacity: {
    name: 'Capacity Maximization',
    description: 'Maximize probability of meeting MW obligation. Primary focus on hitting targets.',
    metrics: ['delivered_kw', 'interval_hit_rate'],
  },
  risk_minimization: {
    name: 'Risk Minimization',
    description: 'Minimize variance and probability of failure. Smooth, reliable performance.',
    metrics: ['variance_kw', 'dropoff_rate', 'p_fail'],
  },
  efficiency: {
    name: 'Efficiency',
    description: 'Maximize value per unit of customer or asset cost. Sustainable long-term.',
    metrics: ['kw_per_soc', 'kw_per_comfort_minute'],
  },
  regret_minimization: {
    name: 'Regret Minimization',
    description: 'Avoid worst-case outcomes. Protect against catastrophic failures.',
    metrics: ['comfort_violations', 'mid_event_failures'],
  },
  learning_oriented: {
    name: 'Learning Oriented',
    description: 'Improve future dispatch by reducing uncertainty about asset behavior.',
    metrics: ['uncertainty_reduction', 'model_error_delta'],
  },
};

// ---------- Selection Ordering Metadata ----------

export const SELECTION_ORDERING_INFO: Record<SelectionOrdering, {
  name: string;
  description: string;
  category: SelectionCategory;
}> = {
  // Asset Type Based
  batteries_first: {
    name: 'Batteries First',
    description: 'Prioritize battery discharge. Fast response, limited duration.',
    category: 'asset_type_based',
  },
  hvac_first: {
    name: 'HVAC First',
    description: 'Lead with thermostat adjustments. Slower but sustained response.',
    category: 'asset_type_based',
  },
  high_load_reduction_first: {
    name: 'High Load Reduction First',
    description: 'Prioritize EV and Fleet charging reduction. High impact, flexible.',
    category: 'asset_type_based',
  },
  balanced_weighting: {
    name: 'Balanced Weighting',
    description: 'Equal weighting across all asset types. Diversified approach.',
    category: 'asset_type_based',
  },
  // Performance Based
  highest_trust_score: {
    name: 'Highest Trust Score',
    description: 'Prioritize assets with best historical reliability.',
    category: 'performance_based',
  },
  lowest_variance: {
    name: 'Lowest Variance',
    description: 'Prioritize assets with most predictable performance.',
    category: 'performance_based',
  },
  best_historical_delivery: {
    name: 'Best Historical Delivery',
    description: 'Prioritize assets that consistently deliver expected kW.',
    category: 'performance_based',
  },
  // State Based
  highest_headroom: {
    name: 'Highest Headroom',
    description: 'Prioritize assets with most capacity available right now.',
    category: 'state_based',
  },
  lowest_marginal_comfort_cost: {
    name: 'Lowest Comfort Cost',
    description: 'Prioritize assets where dispatch causes least customer impact.',
    category: 'state_based',
  },
  highest_soc_buffer: {
    name: 'Highest SOC Buffer',
    description: 'Prioritize batteries/EVs with most energy above reserve.',
    category: 'state_based',
  },
  // Fairness Based
  least_recently_dispatched: {
    name: 'Least Recently Dispatched',
    description: 'Spread dispatch load across assets over time.',
    category: 'fairness_based',
  },
  round_robin: {
    name: 'Round Robin',
    description: 'Cycle through assets in rotation.',
    category: 'fairness_based',
  },
  fatigue_balanced: {
    name: 'Fatigue Balanced',
    description: 'Prioritize assets with lowest accumulated fatigue.',
    category: 'fairness_based',
  },
};

// ---------- Risk Posture Metadata ----------

export const RISK_POSTURE_INFO: Record<RiskPosture, {
  name: string;
  description: string;
  characteristics: string[];
}> = {
  risk_averse: {
    name: 'Risk Averse',
    description: 'High reserves, conservative dispatch. Prioritize reliability over performance.',
    characteristics: ['High reserve margin', 'Early dispatch', 'Slow ramp-up', 'Buffer capacity'],
  },
  neutral: {
    name: 'Neutral',
    description: 'Balanced risk and reward. Standard dispatch behavior.',
    characteristics: ['Moderate reserves', 'Standard timing', 'Balanced approach'],
  },
  opportunity_seeking: {
    name: 'Opportunity Seeking',
    description: 'Calculated risk for higher upside. Aggressive dispatch with lower reserves.',
    characteristics: ['Lower reserves', 'Delayed dispatch', 'Fast ramp-up', 'Higher peak performance'],
  },
  deadline_aware: {
    name: 'Deadline Aware',
    description: 'Aggressiveness increases as time remaining shrinks. Dynamic risk adjustment.',
    characteristics: ['Time-weighted penalties', 'Conservative early, aggressive late', 'Adaptive reserves'],
  },
};

// ---------- Feedback Mode Metadata ----------

export const FEEDBACK_MODE_INFO: Record<FeedbackMode, {
  name: string;
  description: string;
}> = {
  none: {
    name: 'No Feedback',
    description: 'Open-loop dispatch. No adaptation during event.',
  },
  closed_loop: {
    name: 'Closed Loop',
    description: 'Adjust dispatch in real-time based on observed vs. target performance.',
  },
  post_event_learning: {
    name: 'Post-Event Learning',
    description: 'Update asset models and trust scores after events complete.',
  },
};

// ---------- Selection Category Metadata ----------

export const SELECTION_CATEGORY_INFO: Record<SelectionCategory, {
  name: string;
  description: string;
}> = {
  asset_type_based: {
    name: 'Asset Type Based',
    description: 'Order assets by their type (batteries, HVAC, EVs, etc.)',
  },
  performance_based: {
    name: 'Performance Based',
    description: 'Order assets by historical reliability and delivery metrics.',
  },
  state_based: {
    name: 'State Based',
    description: 'Order assets by current state (headroom, SOC, comfort margin).',
  },
  fairness_based: {
    name: 'Fairness Based',
    description: 'Order assets to distribute dispatch burden fairly over time.',
  },
};

// ---------- Legacy Sub-Strategy Metadata (kept for compatibility) ----------

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

// Helper to get sub-strategies for a given top-level strategy (legacy)
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

// Get default sub-strategy for a top-level strategy (legacy)
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

// ---------- Strategy Helpers ----------

// Get orderings for a specific category
export function getOrderingsForCategory(category: SelectionCategory): SelectionOrdering[] {
  return (Object.entries(SELECTION_ORDERING_INFO) as [SelectionOrdering, typeof SELECTION_ORDERING_INFO[SelectionOrdering]][])
    .filter(([_, info]) => info.category === category)
    .map(([key]) => key);
}

// Get subtypes for a specific decision framework
export function getSubtypesForFramework(framework: DecisionFramework): Record<string, { name: string; description: string }> {
  return DECISION_FRAMEWORK_INFO[framework].subtypes;
}

// Validate that a subtype belongs to its framework
export function isValidSubtypeForFramework(framework: DecisionFramework, subtype: FrameworkSubtype): boolean {
  return subtype in DECISION_FRAMEWORK_INFO[framework].subtypes;
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
