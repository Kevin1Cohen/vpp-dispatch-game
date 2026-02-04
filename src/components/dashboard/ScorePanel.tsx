// ============================================
// Score Panel Component
// Performance metrics display
// ============================================

import { SimulationState } from '../../game/types';
import styles from './ScorePanel.module.css';

interface ScorePanelProps {
  state: SimulationState;
}

export function ScorePanel({ state }: ScorePanelProps) {
  const { history, total_penalty, assets } = state;

  const droppedCount = assets.filter((a) => a.state.dropped).length;
  const totalAssets = assets.length;

  const latestResult = history.length > 0 ? history[history.length - 1] : null;
  const avgPenalty = history.length > 0 ? total_penalty / history.length : 0;

  // Calculate average achievement
  const totalTarget = history.reduce((sum, h) => sum + h.target_kw, 0);
  const totalAchieved = history.reduce((sum, h) => sum + h.achieved_kw, 0);
  const avgAchievement = totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 100;

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Performance</h3>

      <div className={styles.metrics}>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Total Penalty</span>
          <span className={styles.metricValue}>
            {total_penalty.toFixed(3)}
          </span>
        </div>

        <div className={styles.metric}>
          <span className={styles.metricLabel}>Avg Penalty/Step</span>
          <span className={styles.metricValue}>
            {avgPenalty.toFixed(4)}
          </span>
        </div>

        <div className={styles.metric}>
          <span className={styles.metricLabel}>Avg Achievement</span>
          <span
            className={styles.metricValue}
            style={{
              color:
                avgAchievement >= 95
                  ? '#22c55e'
                  : avgAchievement >= 80
                  ? '#eab308'
                  : '#ef4444',
            }}
          >
            {avgAchievement.toFixed(1)}%
          </span>
        </div>

        <div className={styles.metric}>
          <span className={styles.metricLabel}>Assets Dropped</span>
          <span
            className={styles.metricValue}
            style={{ color: droppedCount > 0 ? '#ef4444' : '#22c55e' }}
          >
            {droppedCount}/{totalAssets}
          </span>
        </div>

        {latestResult && (
          <>
            <div className={styles.divider} />
            <div className={styles.metric}>
              <span className={styles.metricLabel}>Current Shortfall</span>
              <span
                className={styles.metricValue}
                style={{
                  color: latestResult.shortfall_kw > 0 ? '#ef4444' : '#22c55e',
                }}
              >
                {latestResult.shortfall_kw > 0
                  ? `-${latestResult.shortfall_kw.toFixed(0)} kW`
                  : 'None'}
              </span>
            </div>

            <div className={styles.metric}>
              <span className={styles.metricLabel}>Outdoor Temp</span>
              <span className={styles.metricValue}>
                {latestResult.outdoor_temp_f.toFixed(0)}°F
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
