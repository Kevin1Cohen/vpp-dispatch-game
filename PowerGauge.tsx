// ============================================
// Power Gauge Component
// Radial gauge showing achieved vs target kW
// ============================================

import styles from './PowerGauge.module.css';

interface PowerGaugeProps {
  achieved: number;
  target: number;
}

// Helper to format kW as MW or GW
function formatPower(kw: number): string {
  if (kw >= 1000000) {
    return `${(kw / 1000000).toFixed(2)} GW`;
  } else if (kw >= 1000) {
    return `${(kw / 1000).toFixed(1)} MW`;
  }
  return `${kw.toFixed(0)} kW`;
}

export function PowerGauge({ achieved, target }: PowerGaugeProps) {
  const percentage = target > 0 ? Math.min((achieved / target) * 100, 120) : 0;
  const displayPercentage = Math.min(percentage, 100);

  // Calculate gauge arc
  const radius = 80;
  const circumference = Math.PI * radius; // Half circle
  const strokeDashoffset = circumference - (displayPercentage / 100) * circumference;

  // Color based on percentage
  let color: string;
  let status: string;
  if (percentage >= 95) {
    color = '#22c55e'; // Green
    status = 'On Target';
  } else if (percentage >= 80) {
    color = '#eab308'; // Yellow
    status = 'Warning';
  } else {
    color = '#ef4444'; // Red
    status = 'Shortfall';
  }

  return (
    <div className={styles.container}>
      <div className={styles.gaugeWrapper}>
        <svg viewBox="0 0 200 120" className={styles.gauge}>
          {/* Background arc */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="#334155"
            strokeWidth="16"
            strokeLinecap="round"
          />
          {/* Value arc */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke={color}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 0.3s ease, stroke 0.3s ease' }}
          />
        </svg>

        <div className={styles.centerText}>
          <span className={styles.percentageValue} style={{ color }}>
            {percentage.toFixed(0)}%
          </span>
          <span className={styles.statusText}>{status}</span>
        </div>
      </div>

      <div className={styles.values}>
        <div className={styles.valueItem}>
          <span className={styles.valueLabel}>Achieved</span>
          <span className={styles.valueNumber} style={{ color }}>
            {formatPower(achieved)}
          </span>
        </div>
        <div className={styles.valueDivider}>/</div>
        <div className={styles.valueItem}>
          <span className={styles.valueLabel}>Target</span>
          <span className={styles.valueNumber}>{formatPower(target)}</span>
        </div>
      </div>
    </div>
  );
}
