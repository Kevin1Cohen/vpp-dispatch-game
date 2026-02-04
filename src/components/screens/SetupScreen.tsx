// ============================================
// VPP Simulation Game - Setup Screen
// ============================================

import { useEffect } from 'react';
import { useGame } from '../../context/GameContext';
import {
  ASSET_TYPE_INFO,
  DIFFICULTY_PRESETS,
  AssetType,
  DifficultyLevel,
  DispatchStrategy,
  SubStrategy,
  getSubStrategiesForStrategy,
} from '../../game/types';
import { STRATEGY_INFO } from '../../game/DispatchStrategies';
import { getScenarioSummary } from '../../game/ScenarioGenerator';
import styles from './SetupScreen.module.css';

export function SetupScreen() {
  const {
    state,
    goToScreen,
    setDifficulty,
    setStrategy,
    setSubStrategy,
    toggleAssetType,
    generateNewScenario,
  } = useGame();

  const { gameConfig, scenario } = state;

  // Generate scenario when entering setup or when config changes
  useEffect(() => {
    generateNewScenario();
  }, [gameConfig.difficulty, gameConfig.asset_types, generateNewScenario]);

  const summary = scenario ? getScenarioSummary(scenario) : null;

  // Get sub-strategies for the current top-level strategy
  const subStrategies = getSubStrategiesForStrategy(gameConfig.strategy);

  const handleStartSimulation = () => {
    if (scenario) {
      goToScreen('simulation');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <button className={styles.backButton} onClick={() => goToScreen('rules')}>
          ← Back
        </button>

        <h1 className={styles.title}>Game Setup</h1>

        <div className={styles.columns}>
          {/* Left Column - Configuration */}
          <div className={styles.column}>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Difficulty</h2>
              <div className={styles.difficultyButtons}>
                {(['easy', 'medium', 'hard'] as DifficultyLevel[]).map((level) => (
                  <button
                    key={level}
                    className={`${styles.difficultyButton} ${
                      gameConfig.difficulty === level ? styles.active : ''
                    }`}
                    onClick={() => setDifficulty(level)}
                  >
                    <span className={styles.difficultyName}>
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </span>
                    <span className={styles.difficultyInfo}>
                      {DIFFICULTY_PRESETS[level].total_assets} assets
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Dispatch Strategy</h2>
              <div className={styles.strategyButtons}>
                {(Object.keys(STRATEGY_INFO) as DispatchStrategy[]).map((strat) => (
                  <div key={strat} className={styles.strategyWrapper}>
                    <button
                      className={`${styles.strategyButton} ${
                        gameConfig.strategy === strat ? styles.active : ''
                      }`}
                      onClick={() => setStrategy(strat)}
                    >
                      <span className={styles.strategyName}>{STRATEGY_INFO[strat].name}</span>
                      <span className={styles.strategyDesc}>{STRATEGY_INFO[strat].description}</span>
                    </button>

                    {/* Sub-strategy radio buttons - shown when this strategy is selected */}
                    {gameConfig.strategy === strat && (
                      <div className={styles.subStrategies}>
                        {Object.entries(subStrategies).map(([subKey, subInfo]) => (
                          <label
                            key={subKey}
                            className={`${styles.subStrategyOption} ${
                              gameConfig.subStrategy === subKey ? styles.selected : ''
                            }`}
                          >
                            <input
                              type="radio"
                              name="subStrategy"
                              value={subKey}
                              checked={gameConfig.subStrategy === subKey}
                              onChange={() => setSubStrategy(subKey as SubStrategy)}
                              className={styles.radioInput}
                            />
                            <span className={styles.radioCustom} />
                            <div className={styles.subStrategyContent}>
                              <span className={styles.subStrategyName}>{subInfo.name}</span>
                              <span className={styles.subStrategyDesc}>{subInfo.description}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Asset Types</h2>
              <div className={styles.assetToggles}>
                {(Object.keys(ASSET_TYPE_INFO) as AssetType[]).map((type) => (
                  <button
                    key={type}
                    className={`${styles.assetToggle} ${
                      gameConfig.asset_types.includes(type) ? styles.active : ''
                    }`}
                    onClick={() => toggleAssetType(type)}
                  >
                    <span className={styles.assetIcon}>{ASSET_TYPE_INFO[type].icon}</span>
                    <span className={styles.assetName}>{ASSET_TYPE_INFO[type].name}</span>
                    <span
                      className={`${styles.checkbox} ${
                        gameConfig.asset_types.includes(type) ? styles.checked : ''
                      }`}
                    >
                      {gameConfig.asset_types.includes(type) ? '✓' : ''}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </div>

          {/* Right Column - Scenario Preview */}
          <div className={styles.column}>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Scenario Preview</h2>
              {summary ? (
                <div className={styles.scenarioCard}>
                  <div className={styles.scenarioHeader}>
                    <span className={styles.scenarioIcon}>📋</span>
                    <span className={styles.scenarioTitle}>Generated Scenario</span>
                  </div>

                  <div className={styles.scenarioStats}>
                    <div className={styles.stat}>
                      <span className={styles.statLabel}>Duration</span>
                      <span className={styles.statValue}>{summary.duration}</span>
                    </div>
                    <div className={styles.stat}>
                      <span className={styles.statLabel}>Timesteps</span>
                      <span className={styles.statValue}>{summary.timesteps}</span>
                    </div>
                    <div className={styles.stat}>
                      <span className={styles.statLabel}>Target</span>
                      <span className={styles.statValue}>{summary.targetKw.toLocaleString()} kW</span>
                    </div>
                    <div className={styles.stat}>
                      <span className={styles.statLabel}>Avg Temp</span>
                      <span className={styles.statValue}>{summary.avgTemp}°F</span>
                    </div>
                  </div>

                  <div className={styles.capacityInfo}>
                    <div className={styles.capacityRow}>
                      <span className={styles.capacityLabel}>Max Capacity</span>
                      <span className={styles.capacityValue}>{summary.maxCapacityKw.toLocaleString()} kW</span>
                    </div>
                    <div className={styles.capacityRow}>
                      <span className={styles.capacityLabel}>Headroom</span>
                      <span className={styles.capacityHeadroom}>{summary.capacityHeadroom}x</span>
                    </div>
                    <div className={styles.capacityNote}>
                      You have {summary.capacityHeadroom}x more capacity than needed — choose your dispatch wisely!
                    </div>
                  </div>

                  <div className={styles.assetBreakdown}>
                    <h4 className={styles.breakdownTitle}>Asset Breakdown</h4>
                    <div className={styles.breakdownList}>
                      {(Object.entries(summary.assetBreakdown) as [AssetType, number][])
                        .filter(([, count]) => count > 0)
                        .map(([type, count]) => (
                          <div key={type} className={styles.breakdownItem}>
                            <span className={styles.breakdownIcon}>
                              {ASSET_TYPE_INFO[type].icon}
                            </span>
                            <span className={styles.breakdownName}>
                              {ASSET_TYPE_INFO[type].name}
                            </span>
                            <span className={styles.breakdownCount}>{count}</span>
                          </div>
                        ))}
                    </div>
                    <div className={styles.totalAssets}>
                      <span>Total Assets</span>
                      <span className={styles.totalCount}>{summary.assetCount}</span>
                    </div>
                  </div>

                  <button
                    className={styles.regenerateButton}
                    onClick={generateNewScenario}
                  >
                    🔄 Generate New Scenario
                  </button>
                </div>
              ) : (
                <div className={styles.loading}>Generating scenario...</div>
              )}
            </section>
          </div>
        </div>

        <div className={styles.buttonWrapper}>
          <button
            className={styles.startButton}
            onClick={handleStartSimulation}
            disabled={!scenario}
          >
            Start Simulation
            <span className={styles.arrow}>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
