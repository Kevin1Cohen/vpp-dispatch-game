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
  | { type: 'RESET_GAME' };

// ---------- Initial State ----------

const initialGameConfig: GameConfig = {
  difficulty: 'medium',
  strategy: 'rule_based',
  subStrategy: 'balanced',
  aggressiveness: { ...DEFAULT_AGGRESSIVENESS },
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
      const config: ScenarioGeneratorConfig = {
        difficulty: state.gameConfig.difficulty,
        assetTypes: state.gameConfig.asset_types,
        assetCounts: state.gameConfig.asset_counts,
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
  // Config
  setDifficulty: (difficulty: DifficultyLevel) => void;
  setStrategy: (strategy: DispatchStrategy) => void;
  setSubStrategy: (subStrategy: SubStrategy) => void;
  setAggressiveness: (assetType: AssetType, value: number) => void;
  setAllAggressiveness: (settings: AggressivenessSettings) => void;
  toggleAssetType: (assetType: AssetType) => void;
  setAssetCount: (assetType: AssetType, count: number) => void;
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
    // Update the engine's aggressiveness if it exists
    if (engineRef.current) {
      engineRef.current.updateAggressiveness(assetType, value);
    }
  }, []);

  const setAllAggressiveness = useCallback((settings: AggressivenessSettings) => {
    dispatch({ type: 'SET_ALL_AGGRESSIVENESS', settings });
    if (engineRef.current) {
      engineRef.current.updateAllAggressiveness(settings);
    }
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
        state.gameConfig.strategy,
        state.gameConfig.subStrategy,
        state.gameConfig.aggressiveness,
        handleUpdate,
        handleComplete
      );
    }
    engineRef.current.setSpeed(state.simulationSpeed);
    engineRef.current.start();
  }, [state.scenario, state.gameConfig.strategy, state.gameConfig.subStrategy, state.gameConfig.aggressiveness, state.simulationSpeed, handleUpdate, handleComplete]);

  const pauseSimulation = useCallback(() => {
    engineRef.current?.pause();
  }, []);

  const resetSimulation = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.reset();
    } else if (state.scenario) {
      engineRef.current = new SimulationEngine(
        state.scenario,
        state.gameConfig.strategy,
        state.gameConfig.subStrategy,
        state.gameConfig.aggressiveness,
        handleUpdate,
        handleComplete
      );
      dispatch({ type: 'UPDATE_SIMULATION', state: engineRef.current.getState() });
    }
  }, [state.scenario, state.gameConfig.strategy, state.gameConfig.subStrategy, state.gameConfig.aggressiveness, handleUpdate, handleComplete]);

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
