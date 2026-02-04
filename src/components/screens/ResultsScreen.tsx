// ============================================
// VPP Simulation Game - Results Screen
// Enhanced end game summary with detailed metrics
// ============================================

import { useGame } from '../../context/GameContext';
import { STRATEGY_INFO } from '../../game/DispatchStrategies';
import { calculateEnhancedFinalScore } from '../../game/SimulationEngine';
import { generateResultsSummary } from '../../game/ResultsSummaryGenerator';
import { ASSET_TYPE_INFO, getSubStrategiesForStrategy } from '../../game/types';
import styles from './ResultsScreen.module.css';

export function ResultsScreen() {
  const { state, playAgain, goToScreen } = useGame();
  const { gameConfig, simulationState } = state;

  if (!simulationState) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading results...</div>
      </div>
    );
  }

  // Calculate enhanced score with all new metrics
  const enhancedScore = calculateEnhancedFinalScore(simulationState);

  // Generate rule-based summary
  const summary = generateResultsSummary(enhancedScore, gameConfig);

  const gradeColor =
    enhancedScore.grade.startsWith('A')
      ? '#22c55e'
      : enhancedScore.grade.startsWith('B')
      ? '#3b82f6'
      : enhancedScore.grade.startsWith('C')
      ? '#eab308'
      : '#ef4444';

  // Get sub-strategy name
  const subStrategies = getSubStrategiesForStrategy(gameConfig.strategy);
  const subStrategyName = subStrategies[gameConfig.subStrategy]?.name ?? gameConfig.subStrategy;

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>Event Complete</h1>

        <div className={styles.gradeSection}>
          <div className={styles.gradeCircle} style={{ borderColor: gradeColor }}>
            <span className={styles.grade} style={{ color: gradeColor }}>
              {enhancedScore.grade}
            </span>
          </div>
          <p className={styles.gradeLabel}>Performance Grade</p>
        </div>

        {/* Primary Metrics */}
        <div className={styles.primaryStats}>
          <div className={styles.primaryStatCard}>
            <span className={styles.primaryStatIcon}>⚡</span>
            <div className={styles.primaryStatContent}>
              <span className={styles.primaryStatValue}>
                {enhancedScore.totalKwShifted.toLocaleString()}
              </span>
              <span className={styles.primaryStatUnit}>kW</span>
              <span className={styles.primaryStatLabel}>Total Shifted</span>
            </div>
          </div>

          <div className={styles.primaryStatCard}>
            <span className={styles.primaryStatIcon}>🎯</span>
            <div className={styles.primaryStatContent}>
              <span
                className={styles.primaryStatValue}
                style={{
                  color: enhancedScore.avgKwVsTarget >= 0 ? '#22c55e' : '#ef4444',
                }}
              >
                {enhancedScore.avgKwVsTarget >= 0 ? '+' : ''}
                {enhancedScore.avgKwVsTarget.toFixed(1)}
              </span>
              <span className={styles.primaryStatUnit}>kW</span>
              <span className={styles.primaryStatLabel}>Avg vs Target/Step</span>
            </div>
          </div>
        </div>

        {/* Asset Performance Summary */}
        <div className={styles.assetPerformance}>
          <h3 className={styles.sectionTitle}>Asset Performance</h3>
          <div className={styles.assetStats}>
            <div className={styles.assetStatBox}>
              <span className={styles.assetStatValue} style={{ color: '#22c55e' }}>
                {enhancedScore.totalAssetsPerformed}
              </span>
              <span className={styles.assetStatLabel}>Performed</span>
            </div>
            <div className={styles.assetStatDivider}>vs</div>
            <div className={styles.assetStatBox}>
              <span
                className={styles.assetStatValue}
                style={{ color: enhancedScore.totalAssetsDropped > 0 ? '#ef4444' : '#22c55e' }}
              >
                {enhancedScore.totalAssetsDropped}
              </span>
              <span className={styles.assetStatLabel}>Dropped</span>
            </div>
          </div>

          {/* Per-asset-type breakdown */}
          <div className={styles.assetBreakdown}>
            {enhancedScore.assetTypePerformance
              .filter(p => p.totalDispatched > 0)
              .map(perf => {
                const info = ASSET_TYPE_INFO[perf.assetType];
                const complianceColor =
                  perf.complianceRate >= 90
                    ? '#22c55e'
                    : perf.complianceRate >= 70
                    ? '#eab308'
                    : '#ef4444';
                return (
                  <div key={perf.assetType} className={styles.assetRow}>
                    <span className={styles.assetIcon}>{info.icon}</span>
                    <span className={styles.assetName}>{info.name}</span>
                    <div className={styles.assetMetrics}>
                      <span className={styles.assetCount}>
                        {perf.totalDispatched - perf.totalDropped}/{perf.totalDispatched}
                      </span>
                      <div className={styles.complianceBar}>
                        <div
                          className={styles.complianceFill}
                          style={{
                            width: `${perf.complianceRate}%`,
                            backgroundColor: complianceColor,
                          }}
                        />
                      </div>
                      <span
                        className={styles.compliancePercent}
                        style={{ color: complianceColor }}
                      >
                        {perf.complianceRate.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Summary Paragraph */}
        <div className={styles.summarySection}>
          <h3 className={styles.sectionTitle}>Performance Summary</h3>
          <p className={styles.summaryParagraph}>{summary.mainParagraph}</p>

          {summary.recommendations.length > 0 && (
            <div className={styles.recommendations}>
              <h4 className={styles.recommendationsTitle}>💡 Tips for Next Time</h4>
              <ul className={styles.recommendationsList}>
                {summary.recommendations.map((rec, index) => (
                  <li key={index}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Secondary Stats Grid */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statIcon}>📊</span>
            <div className={styles.statContent}>
              <span className={styles.statValue}>{enhancedScore.totalPenalty}</span>
              <span className={styles.statLabel}>Total Penalty</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <span className={styles.statIcon}>📈</span>
            <div className={styles.statContent}>
              <span className={styles.statValue}>{enhancedScore.averagePenalty}</span>
              <span className={styles.statLabel}>Avg Penalty/Step</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <span className={styles.statIcon}>✅</span>
            <div className={styles.statContent}>
              <span
                className={styles.statValue}
                style={{
                  color:
                    enhancedScore.percentTargetMet >= 95
                      ? '#22c55e'
                      : enhancedScore.percentTargetMet >= 80
                      ? '#eab308'
                      : '#ef4444',
                }}
              >
                {enhancedScore.percentTargetMet}%
              </span>
              <span className={styles.statLabel}>Target Met</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <span className={styles.statIcon}>⏱️</span>
            <div className={styles.statContent}>
              <span className={styles.statValue}>{simulationState.history.length}</span>
              <span className={styles.statLabel}>Timesteps</span>
            </div>
          </div>
        </div>

        {/* Game Configuration */}
        <div className={styles.configSummary}>
          <h3 className={styles.summaryTitle}>Game Configuration</h3>
          <div className={styles.summaryItems}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Difficulty</span>
              <span className={styles.summaryValue}>
                {gameConfig.difficulty.charAt(0).toUpperCase() + gameConfig.difficulty.slice(1)}
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Strategy</span>
              <span className={styles.summaryValue}>
                {STRATEGY_INFO[gameConfig.strategy].name}
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Sub-Strategy</span>
              <span className={styles.summaryValue}>{subStrategyName}</span>
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <button className={styles.secondaryButton} onClick={() => goToScreen('simulation')}>
            View Replay
          </button>
          <button className={styles.primaryButton} onClick={playAgain}>
            Play Again
          </button>
        </div>
      </div>
    </div>
  );
}
