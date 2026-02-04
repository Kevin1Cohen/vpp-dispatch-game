// ============================================
// VPP Simulation Game - Simulation Screen
// Main game view with dashboard
// ============================================

import { useEffect, useRef } from 'react';
import { useGame } from '../../context/GameContext';
import { PowerGauge } from '../dashboard/PowerGauge';
import { TimelineChart } from '../dashboard/TimelineChart';
import { AssetPanel } from '../dashboard/AssetPanel';
import { ScorePanel } from '../dashboard/ScorePanel';
import { PlaybackControls } from '../controls/PlaybackControls';
import { AggressivenessPanel } from '../controls/AggressivenessPanel';
import { formatDuration } from '../../game/SimulationEngine';
import { STRATEGY_INFO } from '../../game/DispatchStrategies';
import { getSubStrategiesForStrategy } from '../../game/types';
import styles from './SimulationScreen.module.css';

export function SimulationScreen() {
  const {
    state,
    goToScreen,
    startSimulation,
    pauseSimulation,
    resetSimulation,
    setSimulationSpeed,
    stepSimulation,
    setAggressiveness,
  } = useGame();

  const { scenario, simulationState, simulationSpeed, gameConfig } = state;
  const initializedRef = useRef(false);

  // Check if we're in replay mode (simulation already complete with history)
  const isReplayMode = simulationState?.is_complete && simulationState?.history.length > 0;

  // Initialize simulation on mount - but only if not already complete (replay mode)
  useEffect(() => {
    if (!initializedRef.current && scenario && !isReplayMode) {
      initializedRef.current = true;
      resetSimulation();
    }
  }, [scenario, resetSimulation, isReplayMode]);

  if (!scenario || !simulationState) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Initializing simulation...</div>
      </div>
    );
  }

  const config = scenario.scenario;
  const { current_timestep, history, is_running, is_complete, assets } = simulationState;

  // Calculate current time
  const startDate = new Date(config.start_time);
  const currentDate = new Date(startDate.getTime() + current_timestep * 5 * 60 * 1000);
  const currentTime = currentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Get current values
  const latestResult = history.length > 0 ? history[history.length - 1] : null;
  const achievedKw = latestResult?.achieved_kw ?? 0;
  const targetKw = config.objective.target_kw ?? 0;

  // Get sub-strategy info
  const subStrategies = getSubStrategiesForStrategy(gameConfig.strategy);
  const subStrategyInfo = subStrategies[gameConfig.subStrategy];

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backButton} onClick={() => goToScreen('setup')}>
            ← Setup
          </button>
          <div className={styles.eventInfo}>
            <h1 className={styles.title}>VPP Event</h1>
            <div className={styles.strategyInfo}>
              <span className={styles.strategy}>
                {STRATEGY_INFO[gameConfig.strategy].name}
              </span>
              <span className={styles.subStrategy}>
                {subStrategyInfo?.name}
              </span>
            </div>
          </div>
        </div>

        <div className={styles.timeDisplay}>
          <span className={styles.currentTime}>{currentTime}</span>
          <span className={styles.progress}>
            Step {current_timestep} / {config.timesteps}
            <span className={styles.duration}>
              ({formatDuration(config.timesteps)})
            </span>
          </span>
        </div>

        <div className={styles.headerRight}>
          {is_complete && (
            <span className={styles.completeTag}>
              {isReplayMode ? '📊 Replay' : 'Complete'}
            </span>
          )}
        </div>
      </header>

      {/* Progress bar */}
      <div className={styles.progressBar}>
        <div
          className={styles.progressFill}
          style={{ width: `${(current_timestep / config.timesteps) * 100}%` }}
        />
      </div>

      {/* Main dashboard */}
      <main className={styles.dashboard}>
        {/* Left column */}
        <div className={styles.leftColumn}>
          <PowerGauge achieved={achievedKw} target={targetKw} />
          <ScorePanel state={simulationState} />
          <AggressivenessPanel
            aggressiveness={gameConfig.aggressiveness}
            enabledAssetTypes={gameConfig.asset_types}
            onAggressivenessChange={setAggressiveness}
          />
        </div>

        {/* Center column */}
        <div className={styles.centerColumn}>
          <TimelineChart history={history} targetKw={targetKw} />

          {isReplayMode ? (
            <div className={styles.replayControls}>
              <div className={styles.replayInfo}>
                <span className={styles.replayLabel}>📊 Viewing completed event replay</span>
                <span className={styles.replayStats}>
                  Final: {latestResult?.achieved_kw.toLocaleString() ?? 0} kW achieved
                  (Target: {targetKw.toLocaleString()} kW)
                </span>
              </div>
              <div className={styles.replayButtons}>
                <button
                  className={styles.replayButton}
                  onClick={() => goToScreen('results')}
                >
                  ← Back to Results
                </button>
                <button
                  className={styles.newGameButton}
                  onClick={() => {
                    initializedRef.current = false;
                    resetSimulation();
                  }}
                >
                  🔄 Run New Simulation
                </button>
              </div>
            </div>
          ) : (
            <PlaybackControls
              isRunning={is_running}
              isComplete={is_complete}
              speed={simulationSpeed}
              onPlay={startSimulation}
              onPause={pauseSimulation}
              onReset={resetSimulation}
              onStep={stepSimulation}
              onSpeedChange={setSimulationSpeed}
            />
          )}
        </div>

        {/* Right column */}
        <div className={styles.rightColumn}>
          <AssetPanel assets={assets} />
        </div>
      </main>
    </div>
  );
}
