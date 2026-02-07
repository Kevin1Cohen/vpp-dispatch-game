// ============================================
// VPP Simulation Game - Setup Screen
// With new Composable Strategy System
// ============================================

import { useEffect, useState } from 'react';
import { useGame } from '../../context/GameContext';
import {
  ASSET_TYPE_INFO,
  DIFFICULTY_PRESETS,
  AssetType,
  DifficultyLevel,
  DecisionFramework,
  FrameworkSubtype,
  ObjectiveFunction,
  SelectionOrdering,
  RiskPosture,
  DECISION_FRAMEWORK_INFO,
  OBJECTIVE_FUNCTION_INFO,
  SELECTION_ORDERING_INFO,
  RISK_POSTURE_INFO,
  SELECTION_CATEGORY_INFO,
  SelectionCategory,
  getOrderingsForCategory,
  getSubtypesForFramework,
} from '../../game/types';
import { getScenarioSummary } from '../../game/ScenarioGenerator';
import styles from './SetupScreen.module.css';

export function SetupScreen() {
  const {
    state,
    goToScreen,
    setDifficulty,
    setDecisionFramework,
    setObjective,
    setSelectionOrderings,
    setRiskPosture,
    toggleAssetType,
    generateNewScenario,
  } = useGame();

  const { gameConfig, scenario } = state;
  const strategyConfig = gameConfig.strategyConfig;

  // Track expanded sections
  const [expandedSection, setExpandedSection] = useState<string | null>('framework');

  // Generate scenario when entering setup or when config changes
  useEffect(() => {
    generateNewScenario();
  }, [gameConfig.difficulty, gameConfig.asset_types, generateNewScenario]);

  const summary = scenario ? getScenarioSummary(scenario) : null;

  // Get subtypes for current framework
  const frameworkSubtypes = getSubtypesForFramework(strategyConfig.decisionFramework);

  // Handle selection ordering toggle
  const handleOrderingToggle = (ordering: SelectionOrdering) => {
    const current = strategyConfig.selectionOrderings;
    if (current.includes(ordering)) {
      // Remove if already selected (but keep at least one)
      if (current.length > 1) {
        setSelectionOrderings(current.filter(o => o !== ordering));
      }
    } else {
      // Add to selections (max 3)
      if (current.length < 3) {
        setSelectionOrderings([...current, ordering]);
      }
    }
  };

  const handleStartSimulation = () => {
    if (scenario) {
      goToScreen('simulation');
    }
  };

  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
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
                {(['easy', 'medium', 'hard'] as DifficultyLevel[]).map((level) => {
                  const preset = DIFFICULTY_PRESETS[level];
                  const targetDisplay = preset.target_mw >= 1000
                    ? `${preset.target_mw / 1000} GW`
                    : `${preset.target_mw} MW`;
                  return (
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
                        {targetDisplay} target
                      </span>
                      <span className={styles.difficultyDetail}>
                        {preset.headroom_multiplier}x headroom · {Math.round(preset.noncompliance * 100)}% dropoff
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Decision Framework Section */}
            <section className={styles.section}>
              <button
                className={styles.sectionHeader}
                onClick={() => toggleSection('framework')}
              >
                <h2 className={styles.sectionTitle}>1. Decision Framework</h2>
                <span className={styles.sectionToggle}>
                  {expandedSection === 'framework' ? '▼' : '▶'}
                </span>
              </button>
              {expandedSection === 'framework' && (
                <div className={styles.strategyButtons}>
                  {(Object.keys(DECISION_FRAMEWORK_INFO) as DecisionFramework[]).map((framework) => {
                    const info = DECISION_FRAMEWORK_INFO[framework];
                    const isSelected = strategyConfig.decisionFramework === framework;
                    return (
                      <div key={framework} className={styles.strategyWrapper}>
                        <button
                          className={`${styles.strategyButton} ${isSelected ? styles.active : ''}`}
                          onClick={() => {
                            const subtypes = Object.keys(info.subtypes) as FrameworkSubtype[];
                            setDecisionFramework(framework, subtypes[0]);
                          }}
                        >
                          <span className={styles.strategyName}>{info.name}</span>
                          <span className={styles.strategyDesc}>{info.description}</span>
                        </button>

                        {isSelected && (
                          <div className={styles.subStrategies}>
                            {Object.entries(frameworkSubtypes).map(([subKey, subInfo]) => (
                              <label
                                key={subKey}
                                className={`${styles.subStrategyOption} ${
                                  strategyConfig.frameworkSubtype === subKey ? styles.selected : ''
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="frameworkSubtype"
                                  value={subKey}
                                  checked={strategyConfig.frameworkSubtype === subKey}
                                  onChange={() => setDecisionFramework(framework, subKey as FrameworkSubtype)}
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
                    );
                  })}
                </div>
              )}
            </section>

            {/* Objective Function Section */}
            <section className={styles.section}>
              <button
                className={styles.sectionHeader}
                onClick={() => toggleSection('objective')}
              >
                <h2 className={styles.sectionTitle}>2. Objective</h2>
                <span className={styles.sectionToggle}>
                  {expandedSection === 'objective' ? '▼' : '▶'}
                </span>
              </button>
              {expandedSection === 'objective' && (
                <div className={styles.objectiveButtons}>
                  {(Object.keys(OBJECTIVE_FUNCTION_INFO) as ObjectiveFunction[]).map((obj) => {
                    const info = OBJECTIVE_FUNCTION_INFO[obj];
                    return (
                      <button
                        key={obj}
                        className={`${styles.objectiveButton} ${
                          strategyConfig.objective === obj ? styles.active : ''
                        }`}
                        onClick={() => setObjective(obj)}
                      >
                        <span className={styles.objectiveName}>{info.name}</span>
                        <span className={styles.objectiveDesc}>{info.description}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Risk Posture Section */}
            <section className={styles.section}>
              <button
                className={styles.sectionHeader}
                onClick={() => toggleSection('risk')}
              >
                <h2 className={styles.sectionTitle}>3. Risk Posture</h2>
                <span className={styles.sectionToggle}>
                  {expandedSection === 'risk' ? '▼' : '▶'}
                </span>
              </button>
              {expandedSection === 'risk' && (
                <>
                  <p className={styles.sectionDescription}>
                    Controls dispatch timing, reserve margins, and how aggressively assets are dispatched.
                    This replaces the old per-asset aggressiveness sliders.
                  </p>
                  <div className={styles.riskButtons}>
                    {(Object.keys(RISK_POSTURE_INFO) as RiskPosture[]).map((posture) => {
                      const info = RISK_POSTURE_INFO[posture];
                      return (
                        <button
                          key={posture}
                          className={`${styles.riskButton} ${
                            strategyConfig.riskPosture === posture ? styles.active : ''
                          }`}
                          onClick={() => setRiskPosture(posture)}
                        >
                          <span className={styles.riskName}>{info.name}</span>
                          <span className={styles.riskDesc}>{info.description}</span>
                          <div className={styles.riskCharacteristics}>
                            {info.characteristics.map((char, i) => (
                              <span key={i} className={styles.riskChar}>{char}</span>
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </section>

            {/* Selection Ordering Section */}
            <section className={styles.section}>
              <button
                className={styles.sectionHeader}
                onClick={() => toggleSection('selection')}
              >
                <h2 className={styles.sectionTitle}>4. Asset Selection Order</h2>
                <span className={styles.sectionToggle}>
                  {expandedSection === 'selection' ? '▼' : '▶'}
                </span>
              </button>
              {expandedSection === 'selection' && (
                <>
                  <p className={styles.sectionDescription}>
                    Choose up to 3 criteria to order assets for dispatch. Primary criteria has most weight.
                  </p>
                  <div className={styles.selectionCategories}>
                    {(Object.keys(SELECTION_CATEGORY_INFO) as SelectionCategory[]).map((category) => {
                      const catInfo = SELECTION_CATEGORY_INFO[category];
                      const orderings = getOrderingsForCategory(category);
                      return (
                        <div key={category} className={styles.selectionCategory}>
                          <h4 className={styles.categoryTitle}>{catInfo.name}</h4>
                          <div className={styles.orderingButtons}>
                            {orderings.map((ordering) => {
                              const info = SELECTION_ORDERING_INFO[ordering];
                              const isSelected = strategyConfig.selectionOrderings.includes(ordering);
                              const orderIndex = strategyConfig.selectionOrderings.indexOf(ordering);
                              return (
                                <button
                                  key={ordering}
                                  className={`${styles.orderingButton} ${isSelected ? styles.active : ''}`}
                                  onClick={() => handleOrderingToggle(ordering)}
                                  title={info.description}
                                >
                                  {isSelected && (
                                    <span className={styles.orderingRank}>{orderIndex + 1}</span>
                                  )}
                                  <span className={styles.orderingName}>{info.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className={styles.selectedOrderings}>
                    <span className={styles.selectedLabel}>Current order:</span>
                    {strategyConfig.selectionOrderings.map((ordering, i) => (
                      <span key={ordering} className={styles.selectedOrdering}>
                        {i + 1}. {SELECTION_ORDERING_INFO[ordering].name}
                      </span>
                    ))}
                  </div>
                </>
              )}
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
                      <span className={styles.statValue}>
                        {summary.targetKw >= 1000000
                          ? `${(summary.targetKw / 1000000).toFixed(1)} GW`
                          : `${(summary.targetKw / 1000).toFixed(0)} MW`}
                      </span>
                    </div>
                    <div className={styles.stat}>
                      <span className={styles.statLabel}>Avg Temp</span>
                      <span className={styles.statValue}>{summary.avgTemp}°F</span>
                    </div>
                  </div>

                  <div className={styles.capacityInfo}>
                    <div className={styles.capacityRow}>
                      <span className={styles.capacityLabel}>Max Capacity</span>
                      <span className={styles.capacityValue}>
                        {summary.maxCapacityKw >= 1000000
                          ? `${(summary.maxCapacityKw / 1000000).toFixed(2)} GW`
                          : `${(summary.maxCapacityKw / 1000).toFixed(0)} MW`}
                      </span>
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
