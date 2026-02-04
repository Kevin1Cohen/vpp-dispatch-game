// ============================================
// Aggressiveness Panel Component
// Per-asset-type sliders for real-time control
// ============================================

import { AssetType, AggressivenessSettings, ASSET_TYPE_INFO } from '../../game/types';
import styles from './AggressivenessPanel.module.css';

interface AggressivenessPanelProps {
  aggressiveness: AggressivenessSettings;
  enabledAssetTypes: AssetType[];
  onAggressivenessChange: (assetType: AssetType, value: number) => void;
}

export function AggressivenessPanel({
  aggressiveness,
  enabledAssetTypes,
  onAggressivenessChange,
}: AggressivenessPanelProps) {
  // Get the label for the aggressiveness level
  const getAggressivenessLabel = (value: number): string => {
    if (value <= 20) return 'Gentle';
    if (value <= 40) return 'Moderate';
    if (value <= 60) return 'Balanced';
    if (value <= 80) return 'Aggressive';
    return 'Maximum';
  };

  // Get color based on aggressiveness level
  const getAggressivenessColor = (value: number): string => {
    if (value <= 30) return '#22c55e'; // Green - safe
    if (value <= 60) return '#eab308'; // Yellow - moderate
    return '#ef4444'; // Red - aggressive
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Aggressiveness</h3>
        <span className={styles.hint}>Adjust during simulation</span>
      </div>

      <div className={styles.sliders}>
        {enabledAssetTypes.map((assetType) => {
          const value = aggressiveness[assetType];
          const info = ASSET_TYPE_INFO[assetType];
          const color = getAggressivenessColor(value);
          const label = getAggressivenessLabel(value);

          return (
            <div key={assetType} className={styles.sliderRow}>
              <div className={styles.sliderHeader}>
                <span className={styles.assetIcon}>{info.icon}</span>
                <span className={styles.assetName}>{info.name}</span>
                <span className={styles.valueLabel} style={{ color }}>
                  {value}% - {label}
                </span>
              </div>
              <div className={styles.sliderWrapper}>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={value}
                  onChange={(e) => onAggressivenessChange(assetType, parseInt(e.target.value))}
                  className={styles.slider}
                  style={{
                    background: `linear-gradient(to right, ${color} 0%, ${color} ${value}%, #334155 ${value}%, #334155 100%)`,
                  }}
                />
                <div className={styles.tickMarks}>
                  <span>0</span>
                  <span>25</span>
                  <span>50</span>
                  <span>75</span>
                  <span>100</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.footer}>
        <span className={styles.footerHint}>
          Higher values = more reduction, higher drop-off risk
        </span>
      </div>
    </div>
  );
}
