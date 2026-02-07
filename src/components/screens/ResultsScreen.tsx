// ============================================
// VPP Simulation Game - Results Screen
// Enhanced end game summary with detailed metrics
// Updated for Composable Strategy System
// ============================================

import { useGame } from '../../context/GameContext';
import { calculateEnhancedFinalScore } from '../../game/SimulationEngine';
import { generateResultsSummary } from '../../game/ResultsSummaryGenerator';
import {
  ASSET_TYPE_INFO,
  DECISION_FRAMEWORK_INFO,
  OBJECTIVE_FUNCTION_INFO,
  RISK_POSTURE_INFO,
  SELECTION_ORDERING_INFO,
} from '../../game/types';
import styles from './ResultsScreen.module.css';

// Helper to format kW as MW or GW
function formatPower(kw: number, includeSign: boolean = false): { value: string; unit: string } {
  const absKw = Math.abs(kw);
  const sign = includeSign && kw >= 0 ? '+' : '';
  if (absKw >= 1000000) {
    return { value: `${sign}${(kw / 1000000).toFixed(2)}`, unit: 'GW' };
  } else if (absKw >= 1000) {
    return { value: `${sign}${(kw / 1000).toFixed(1)}`, unit: 'MW' };
  }
  return { value: `${sign}${kw.toFixed(0)}`, unit: 'kW' };
}

// Helper to format kWh as MWh or GWh (energy)
function formatEnergy(kwh: number): { value: string; unit: string } {
  const absKwh = Math.abs(kwh);
  if (absKwh >= 1000000) {
    return { value: `${(kwh / 1000000).toFixed(2)}`, unit: 'GWh' };
  } else if (absKwh >= 1000) {
    return { value: `${(kwh / 1000).toFixed(1)}`, unit: 'MWh' };
  }
  return { value: `${kwh.toFixed(0)}`, unit: 'kWh' };
}

// Calculate total energy shifted in kWh from timestep data
// Each timestep is 5 minutes = 5/60 hours
const TIMESTEP_HOURS = 5 / 60;

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

  // Get strategy configuration display names
  const strategyConfig = gameConfig.strategyConfig;
  const frameworkInfo = DECISION_FRAMEWORK_INFO[strategyConfig.decisionFramework];
  const frameworkSubtypeInfo = frameworkInfo.subtypes[strategyConfig.frameworkSubtype];
  const objectiveInfo = OBJECTIVE_FUNCTION_INFO[strategyConfig.objective];
  const riskInfo = RISK_POSTURE_INFO[strategyConfig.riskPosture];

  // Calculate total energy shifted (kWh) from all timesteps
  // Energy = sum of (achieved_kw * timestep_duration_in_hours)
  const totalEnergyKwh = simulationState.history.reduce(
    (sum, result) => sum + result.achieved_kw * TIMESTEP_HOURS,
    0
  );
  const formattedEnergy = formatEnergy(totalEnergyKwh);

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
              <div className={styles.primaryStatValueRow}>
                <span className={styles.primaryStatValue}>
                  {formattedEnergy.value}
                </span>
                <span className={styles.primaryStatUnit}>{formattedEnergy.unit}</span>
              </div>
              <span className={styles.primaryStatLabel}>Energy Shifted</span>
            </div>
          </div>

          <div className={styles.primaryStatCard}>
            <span className={styles.primaryStatIcon}>🎯</span>
            <div className={styles.primaryStatContent}>
              <div className={styles.primaryStatValueRow}>
                <span
                  className={styles.primaryStatValue}
                  style={{
                    color: enhancedScore.avgKwVsTarget >= 0 ? '#22c55e' : '#ef4444',
                  }}
                >
                  {formatPower(enhancedScore.avgKwVsTarget, true).value}
                </span>
                <span className={styles.primaryStatUnit}>{formatPower(enhancedScore.avgKwVsTarget, true).unit}</span>
              </div>
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

        {/* Strategy Configuration */}
        <div className={styles.configSummary}>
          <h3 className={styles.summaryTitle}>Strategy Configuration</h3>
          <div className={styles.strategyGrid}>
            <div className={styles.strategyItem}>
              <span className={styles.strategyLabel}>Difficulty</span>
              <span className={styles.strategyValue}>
                {gameConfig.difficulty.charAt(0).toUpperCase() + gameConfig.difficulty.slice(1)}
              </span>
            </div>
            <div className={styles.strategyItem}>
              <span className={styles.strategyLabel}>Framework</span>
              <span className={styles.strategyValue}>{frameworkInfo.name}</span>
              <span className={styles.strategySubValue}>{frameworkSubtypeInfo?.name || strategyConfig.frameworkSubtype}</span>
            </div>
            <div className={styles.strategyItem}>
              <span className={styles.strategyLabel}>Objective</span>
              <span className={styles.strategyValue}>{objectiveInfo.name}</span>
            </div>
            <div className={styles.strategyItem}>
              <span className={styles.strategyLabel}>Risk Posture</span>
              <span className={styles.strategyValue}>{riskInfo.name}</span>
            </div>
            <div className={styles.strategyItem}>
              <span className={styles.strategyLabel}>Asset Selection</span>
              <div className={styles.orderingsList}>
                {strategyConfig.selectionOrderings.map((ordering, i) => (
                  <span key={ordering} className={styles.orderingItem}>
                    {i + 1}. {SELECTION_ORDERING_INFO[ordering].name}
                  </span>
                ))}
              </div>
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
