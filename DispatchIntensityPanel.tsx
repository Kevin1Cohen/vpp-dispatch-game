// ============================================
// Dispatch Intensity Panel Component
// Per-asset-type sliders for real-time control
// Controls both dispatch priority and capacity utilization
// ============================================

import { AssetType, DispatchIntensitySettings, ASSET_TYPE_INFO } from '../../game/types';
import styles from './DispatchIntensityPanel.module.css';

interface DispatchIntensityPanelProps {
  intensity: DispatchIntensitySettings;
  enabledAssetTypes: AssetType[];
  onIntensityChange: (assetType: AssetType, value: number) => void;
}

export function DispatchIntensityPanel({
  intensity,
  enabledAssetTypes,
  onIntensityChange,
}: DispatchIntensityPanelProps) {
  // Get the label for the intensity level
  const getIntensityLabel = (value: number): string => {
    if (value <= 20) return 'Minimal';
    if (value <= 40) return 'Light';
    if (value <= 60) return 'Moderate';
    if (value <= 80) return 'Heavy';
    return 'Maximum';
  };

  // Get color based on intensity level
  const getIntensityColor = (value: number): string => {
    if (value <= 30) return '#22c55e'; // Green - low intensity
    if (value <= 60) return '#eab308'; // Yellow - moderate
    return '#ef4444'; // Red - high intensity
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h3 className={styles.title}>Dispatch Intensity</h3>
          <span className={styles.hint}>Adjust in real-time</span>
        </div>
        <p className={styles.description}>
          Controls how aggressively each asset type is dispatched. Higher values =
          dispatched earlier and pushed harder.
        </p>
      </div>

      <div className={styles.sliders}>
        {enabledAssetTypes.map((assetType) => {
          const value = intensity[assetType];
          const info = ASSET_TYPE_INFO[assetType];
          const color = getIntensityColor(value);
          const label = getIntensityLabel(value);

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
                  onChange={(e) => onIntensityChange(assetType, parseInt(e.target.value))}
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
        <div className={styles.footerHint}>
          <strong>Priority:</strong> Higher intensity assets are dispatched first
        </div>
        <div className={styles.footerHint}>
          <strong>Utilization:</strong> Higher intensity = more kW requested per asset
        </div>
      </div>
    </div>
  );
}

// Re-export with legacy name for backward compatibility
export { DispatchIntensityPanel as AggressivenessPanel };
