// ============================================
// VPP Simulation Game - Game Context
// Global state management with React Context
// ============================================

import React, { createContext, useContext, useReducer, useCallback, useRef } from 'react';
import {
  Scenario,
  SimulationState,
  DifficultyLevel,
  DispatchStrategy,
  SubStrategy,
  AssetType,
  GameConfig,
  AggressivenessSettings,
  DEFAULT_AGGRESSIVENESS,
  getDefaultSubStrategy,
  StrategyConfig,
  DEFAULT_STRATEGY_CONFIG,
  DecisionFramework,
  FrameworkSubtype,
  ObjectiveFunction,
  SelectionOrdering,
  RiskPosture,
  FeedbackMode,
} from '../game/types';
import { generateScenario, ScenarioGeneratorConfig } from '../game/ScenarioGenerator';
import { SimulationEngine, calculateFinalScore } from '../game/SimulationEngine';

// ---------- State Types ----------

type Screen = 'welcome' | 'rules' | 'setup' | 'simulation' | 'results';

interface GameState {
  screen: Screen;
  scenario: Scenario | null;
  gameConfig: GameConfig;
  simulationState: SimulationState | null;
  simulationSpeed: number;
  finalScore: {
    totalPenalty: number;
    averagePenalty: number;
    percentTargetMet: number;
    assetsDropped: number;
    grade: string;
  } | null;
}

// ---------- Action Types ----------

type GameAction =
  | { type: 'SET_SCREEN'; screen: Screen }
  | { type: 'SET_DIFFICULTY'; difficulty: DifficultyLevel }
  | { type: 'SET_STRATEGY'; strategy: DispatchStrategy }
  | { type: 'SET_SUB_STRATEGY'; subStrategy: SubStrategy }
  | { type: 'SET_AGGRESSIVENESS'; assetType: AssetType; value: number }
  | { type: 'SET_ALL_AGGRESSIVENESS'; settings: AggressivenessSettings }
  | { type: 'TOGGLE_ASSET_TYPE'; assetType: AssetType }
  | { type: 'SET_ASSET_COUNT'; assetType: AssetType; count: number }
  | { type: 'GENERATE_SCENARIO' }
  | { type: 'SET_SCENARIO'; scenario: Scenario }
  | { type: 'UPDATE_SIMULATION'; state: SimulationState }
  | { type: 'SET_SPEED'; speed: number }
  | { type: 'SIMULATION_COMPLETE'; state: SimulationState }
  | { type: 'RESET_GAME' }
  // New composable strategy actions
  | { type: 'SET_STRATEGY_CONFIG'; config: StrategyConfig }
  | { type: 'SET_DECISION_FRAMEWORK'; framework: DecisionFramework; subtype: FrameworkSubtype }
  | { type: 'SET_OBJECTIVE'; objective: ObjectiveFunction }
  | { type: 'SET_SELECTION_ORDERINGS'; orderings: SelectionOrdering[] }
  | { type: 'SET_RISK_POSTURE'; riskPosture: RiskPosture }
  | { type: 'SET_FEEDBACK_MODE'; feedbackMode: FeedbackMode };

// ---------- Initial State ----------

const initialGameConfig: GameConfig = {
  difficulty: 'medium',
  // New composable strategy system
  strategyConfig: { ...DEFAULT_STRATEGY_CONFIG },
  // Legacy fields (kept for backward compatibility)
  strategy: 'rule_based',
  subStrategy: 'balanced',
  aggressiveness: { ...DEFAULT_AGGRESSIVENESS },
  // Asset configuration
  asset_types: ['hvac_resi', 'battery_resi', 'ev_resi'],
  asset_counts: {
    hvac_resi: 50,
    battery_resi: 30,
    ev_resi: 40,
    fleet_site: 5,
    ci_building: 10,
  },
};

const initialState: GameState = {
  screen: 'welcome',
  scenario: null,
  gameConfig: initialGameConfig,
  simulationState: null,
  simulationSpeed: 1,
  finalScore: null,
};

// ---------- Reducer ----------

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_SCREEN':
      return { ...state, screen: action.screen };

    case 'SET_DIFFICULTY':
      return {
        ...state,
        gameConfig: { ...state.gameConfig, difficulty: action.difficulty },
      };

    case 'SET_STRATEGY':
      // When changing top-level strategy, reset sub-strategy to default for that strategy
      return {
        ...state,
        gameConfig: {
          ...state.gameConfig,
          strategy: action.strategy,
          subStrategy: getDefaultSubStrategy(action.strategy),
        },
      };

    case 'SET_SUB_STRATEGY':
      return {
        ...state,
        gameConfig: { ...state.gameConfig, subStrategy: action.subStrategy },
      };

    case 'SET_AGGRESSIVENESS':
      return {
        ...state,
        gameConfig: {
          ...state.gameConfig,
          aggressiveness: {
            ...state.gameConfig.aggressiveness,
            [action.assetType]: action.value,
          },
        },
      };

    case 'SET_ALL_AGGRESSIVENESS':
      return {
        ...state,
        gameConfig: {
          ...state.gameConfig,
          aggressiveness: action.settings,
        },
      };

    case 'TOGGLE_ASSET_TYPE': {
      const currentTypes = state.gameConfig.asset_types;
      const hasType = currentTypes.includes(action.assetType);
      const newTypes = hasType
        ? currentTypes.filter(t => t !== action.assetType)
        : [...currentTypes, action.assetType];
      // Ensure at least one type is selected
      if (newTypes.length === 0) return state;
      return {
        ...state,
        gameConfig: { ...state.gameConfig, asset_types: newTypes },
      };
    }

    case 'SET_ASSET_COUNT':
      return {
        ...state,
        gameConfig: {
          ...state.gameConfig,
          asset_counts: {
            ...state.gameConfig.asset_counts,
            [action.assetType]: action.count,
          },
        },
      };

    case 'GENERATE_SCENARIO': {
      // Don't pass assetCounts - let the scenario generator use the
      // total_assets from difficulty presets and distribute evenly
      const config: ScenarioGeneratorConfig = {
        difficulty: state.gameConfig.difficulty,
        assetTypes: state.gameConfig.asset_types,
      };
      const scenario = generateScenario(config);
      return { ...state, scenario };
    }

    case 'SET_SCENARIO':
      return { ...state, scenario: action.scenario };

    case 'UPDATE_SIMULATION':
      return { ...state, simulationState: action.state };

    case 'SET_SPEED':
      return { ...state, simulationSpeed: action.speed };

    case 'SIMULATION_COMPLETE': {
      const score = calculateFinalScore(action.state);
      return {
        ...state,
        simulationState: action.state,
        finalScore: score,
        screen: 'results',
      };
    }

    case 'RESET_GAME':
      return {
        ...initialState,
        gameConfig: state.gameConfig, // Keep config
      };

    // New composable strategy actions
    case 'SET_STRATEGY_CONFIG':
      return {
        ...state,
        gameConfig: { ...state.gameConfig, strategyConfig: action.config },
      };

    case 'SET_DECISION_FRAMEWORK':
      return {
        ...state,
        gameConfig: {
          ...state.gameConfig,
          strategyConfig: {
            ...state.gameConfig.strategyConfig,
            decisionFramework: action.framework,
            frameworkSubtype: action.subtype,
          },
        },
      };

    case 'SET_OBJECTIVE':
      return {
        ...state,
        gameConfig: {
          ...state.gameConfig,
          strategyConfig: {
            ...state.gameConfig.strategyConfig,
            objective: action.objective,
          },
        },
      };

    case 'SET_SELECTION_ORDERINGS':
      return {
        ...state,
        gameConfig: {
          ...state.gameConfig,
          strategyConfig: {
            ...state.gameConfig.strategyConfig,
            selectionOrderings: action.orderings,
          },
        },
      };

    case 'SET_RISK_POSTURE':
      return {
        ...state,
        gameConfig: {
          ...state.gameConfig,
          strategyConfig: {
            ...state.gameConfig.strategyConfig,
            riskPosture: action.riskPosture,
          },
        },
      };

    case 'SET_FEEDBACK_MODE':
      return {
        ...state,
        gameConfig: {
          ...state.gameConfig,
          strategyConfig: {
            ...state.gameConfig.strategyConfig,
            feedbackMode: action.feedbackMode,
          },
        },
      };

    default:
      return state;
  }
}

// ---------- Context ----------

interface GameContextType {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  // Navigation
  goToScreen: (screen: Screen) => void;
  // Config (legacy)
  setDifficulty: (difficulty: DifficultyLevel) => void;
  setStrategy: (strategy: DispatchStrategy) => void;
  setSubStrategy: (subStrategy: SubStrategy) => void;
  setAggressiveness: (assetType: AssetType, value: number) => void;
  setAllAggressiveness: (settings: AggressivenessSettings) => void;
  toggleAssetType: (assetType: AssetType) => void;
  setAssetCount: (assetType: AssetType, count: number) => void;
  // New composable strategy config
  setStrategyConfig: (config: StrategyConfig) => void;
  setDecisionFramework: (framework: DecisionFramework, subtype: FrameworkSubtype) => void;
  setObjective: (objective: ObjectiveFunction) => void;
  setSelectionOrderings: (orderings: SelectionOrdering[]) => void;
  setRiskPosture: (riskPosture: RiskPosture) => void;
  setFeedbackMode: (feedbackMode: FeedbackMode) => void;
  // Scenario
  generateNewScenario: () => void;
  // Simulation
  startSimulation: () => void;
  pauseSimulation: () => void;
  resetSimulation: () => void;
  setSimulationSpeed: (speed: number) => void;
  stepSimulation: () => void;
  // Game
  playAgain: () => void;
}

const GameContext = createContext<GameContextType | null>(null);

// ---------- Provider ----------

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const engineRef = useRef<SimulationEngine | null>(null);

  // Navigation
  const goToScreen = useCallback((screen: Screen) => {
    dispatch({ type: 'SET_SCREEN', screen });
  }, []);

  // Config
  const setDifficulty = useCallback((difficulty: DifficultyLevel) => {
    dispatch({ type: 'SET_DIFFICULTY', difficulty });
  }, []);

  const setStrategy = useCallback((strategy: DispatchStrategy) => {
    dispatch({ type: 'SET_STRATEGY', strategy });
  }, []);

  const setSubStrategy = useCallback((subStrategy: SubStrategy) => {
    dispatch({ type: 'SET_SUB_STRATEGY', subStrategy });
  }, []);

  const setAggressiveness = useCallback((assetType: AssetType, value: number) => {
    dispatch({ type: 'SET_AGGRESSIVENESS', assetType, value });
    // Legacy: no longer directly updates engine
  }, []);

  const setAllAggressiveness = useCallback((settings: AggressivenessSettings) => {
    dispatch({ type: 'SET_ALL_AGGRESSIVENESS', settings });
    // Legacy: no longer directly updates engine
  }, []);

  // New composable strategy methods
  const setStrategyConfig = useCallback((config: StrategyConfig) => {
    dispatch({ type: 'SET_STRATEGY_CONFIG', config });
  }, []);

  const setDecisionFramework = useCallback((framework: DecisionFramework, subtype: FrameworkSubtype) => {
    dispatch({ type: 'SET_DECISION_FRAMEWORK', framework, subtype });
  }, []);

  const setObjective = useCallback((objective: ObjectiveFunction) => {
    dispatch({ type: 'SET_OBJECTIVE', objective });
  }, []);

  const setSelectionOrderings = useCallback((orderings: SelectionOrdering[]) => {
    dispatch({ type: 'SET_SELECTION_ORDERINGS', orderings });
  }, []);

  const setRiskPosture = useCallback((riskPosture: RiskPosture) => {
    dispatch({ type: 'SET_RISK_POSTURE', riskPosture });
    // Update engine if running
    if (engineRef.current) {
      engineRef.current.updateRiskPosture(riskPosture);
    }
  }, []);

  const setFeedbackMode = useCallback((feedbackMode: FeedbackMode) => {
    dispatch({ type: 'SET_FEEDBACK_MODE', feedbackMode });
  }, []);

  const toggleAssetType = useCallback((assetType: AssetType) => {
    dispatch({ type: 'TOGGLE_ASSET_TYPE', assetType });
  }, []);

  const setAssetCount = useCallback((assetType: AssetType, count: number) => {
    dispatch({ type: 'SET_ASSET_COUNT', assetType, count });
  }, []);

  // Scenario
  const generateNewScenario = useCallback(() => {
    dispatch({ type: 'GENERATE_SCENARIO' });
  }, []);

  // Simulation callbacks
  const handleUpdate = useCallback((simState: SimulationState) => {
    dispatch({ type: 'UPDATE_SIMULATION', state: simState });
  }, []);

  const handleComplete = useCallback((simState: SimulationState) => {
    dispatch({ type: 'SIMULATION_COMPLETE', state: simState });
  }, []);

  // Simulation controls
  const startSimulation = useCallback(() => {
    if (!state.scenario) return;

    if (!engineRef.current) {
      engineRef.current = new SimulationEngine(
        state.scenario,
        state.gameConfig.strategyConfig,
        state.gameConfig.difficulty,
        handleUpdate,
        handleComplete
      );
    }
    engineRef.current.setSpeed(state.simulationSpeed);
    engineRef.current.start();
  }, [state.scenario, state.gameConfig.strategyConfig, state.gameConfig.difficulty, state.simulationSpeed, handleUpdate, handleComplete]);

  const pauseSimulation = useCallback(() => {
    engineRef.current?.pause();
  }, []);

  const resetSimulation = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.reset();
    } else if (state.scenario) {
      engineRef.current = new SimulationEngine(
        state.scenario,
        state.gameConfig.strategyConfig,
        state.gameConfig.difficulty,
        handleUpdate,
        handleComplete
      );
      dispatch({ type: 'UPDATE_SIMULATION', state: engineRef.current.getState() });
    }
  }, [state.scenario, state.gameConfig.strategyConfig, state.gameConfig.difficulty, handleUpdate, handleComplete]);

  const setSimulationSpeed = useCallback((speed: number) => {
    dispatch({ type: 'SET_SPEED', speed });
    engineRef.current?.setSpeed(speed);
  }, []);

  const stepSimulation = useCallback(() => {
    engineRef.current?.step();
  }, []);

  // Game
  const playAgain = useCallback(() => {
    engineRef.current = null;
    // Reset simulation state but keep config, then go to setup screen
    dispatch({ type: 'RESET_GAME' });
    dispatch({ type: 'SET_SCREEN', screen: 'setup' });
  }, []);

  const value: GameContextType = {
    state,
    dispatch,
    goToScreen,
    setDifficulty,
    setStrategy,
    setSubStrategy,
    setAggressiveness,
    setAllAggressiveness,
    toggleAssetType,
    setAssetCount,
    // New composable strategy methods
    setStrategyConfig,
    setDecisionFramework,
    setObjective,
    setSelectionOrderings,
    setRiskPosture,
    setFeedbackMode,
    // Scenario & simulation
    generateNewScenario,
    startSimulation,
    pauseSimulation,
    resetSimulation,
    setSimulationSpeed,
    stepSimulation,
    playAgain,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

// ---------- Hook ----------

export function useGame(): GameContextType {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
