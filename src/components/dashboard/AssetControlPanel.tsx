// ============================================
// Asset Control Panel Component
// Tabbed container for Asset Status and Dispatch Intensity
// ============================================

import { useState } from 'react';
import { Asset, AssetType, DispatchIntensitySettings, ASSET_TYPE_INFO } from '../../game/types';
import { getAssetStatus, AssetStatus } from '../../game/AssetModels';
import styles from './AssetControlPanel.module.css';

interface AssetControlPanelProps {
  assets: Asset[];
  dispatchIntensity: DispatchIntensitySettings;
  enabledAssetTypes: AssetType[];
  onIntensityChange: (assetType: AssetType, value: number) => void;
}

export function AssetControlPanel({
  assets,
  dispatchIntensity,
  enabledAssetTypes,
  onIntensityChange,
}: AssetControlPanelProps) {
  const [activeTab, setActiveTab] = useState<'status' | 'intensity'>('intensity');

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'status' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('status')}
          >
            Asset Status
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'intensity' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('intensity')}
          >
            Dispatch Intensity
          </button>
        </div>
      </div>

      {activeTab === 'status' ? (
        <AssetStatusContent assets={assets} />
      ) : (
        <DispatchIntensityContent
          intensity={dispatchIntensity}
          enabledAssetTypes={enabledAssetTypes}
          onIntensityChange={onIntensityChange}
        />
      )}
    </div>
  );
}

// Asset Status Tab Content
function AssetStatusContent({ assets }: { assets: Asset[] }) {
  const [filter, setFilter] = useState<AssetType | 'all'>('all');
  const [showDropped, setShowDropped] = useState(true);

  const filteredAssets = assets.filter((a) => {
    if (filter !== 'all' && a.type !== filter) return false;
    if (!showDropped && a.state.dropped) return false;
    return true;
  });

  const assetStatuses: AssetStatus[] = filteredAssets.map(getAssetStatus);

  // Count by type
  const typeCounts: Record<AssetType | 'all', { total: number; dropped: number }> = {
    all: { total: assets.length, dropped: assets.filter((a) => a.state.dropped).length },
    hvac_resi: { total: 0, dropped: 0 },
    battery_resi: { total: 0, dropped: 0 },
    ev_resi: { total: 0, dropped: 0 },
    fleet_site: { total: 0, dropped: 0 },
    ci_building: { total: 0, dropped: 0 },
  };

  for (const asset of assets) {
    typeCounts[asset.type].total++;
    if (asset.state.dropped) typeCounts[asset.type].dropped++;
  }

  return (
    <div className={styles.statusContent}>
      <div className={styles.statusHeader}>
        <div className={styles.filters}>
          <button
            className={`${styles.filterButton} ${filter === 'all' ? styles.active : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({typeCounts.all.total.toLocaleString()})
          </button>
          {(Object.keys(ASSET_TYPE_INFO) as AssetType[]).map((type) => (
            typeCounts[type].total > 0 && (
              <button
                key={type}
                className={`${styles.filterButton} ${filter === type ? styles.active : ''}`}
                onClick={() => setFilter(type)}
              >
                {ASSET_TYPE_INFO[type].icon} {typeCounts[type].total.toLocaleString()}
              </button>
            )
          ))}
        </div>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={showDropped}
            onChange={(e) => setShowDropped(e.target.checked)}
          />
          <span>Show dropped</span>
        </label>
      </div>

      <div className={styles.assetGrid}>
        {assetStatuses.slice(0, 50).map((status) => (
          <AssetCard key={status.id} status={status} />
        ))}
      </div>

      {assetStatuses.length > 50 && (
        <p className={styles.overflow}>
          Showing 50 of {assetStatuses.length.toLocaleString()} assets
        </p>
      )}
    </div>
  );
}

function AssetCard({ status }: { status: AssetStatus }) {
  const statusColor =
    status.status === 'dropped'
      ? '#ef4444'
      : status.status === 'constrained'
      ? '#eab308'
      : '#22c55e';

  const icon = ASSET_TYPE_INFO[status.type as AssetType]?.icon || '?';

  return (
    <div className={`${styles.card} ${status.status === 'dropped' ? styles.dropped : ''}`}>
      <div className={styles.cardHeader}>
        <span className={styles.cardIcon}>{icon}</span>
        <span
          className={styles.statusDot}
          style={{ background: statusColor }}
          title={status.status}
        />
      </div>
      <div className={styles.cardId}>{status.id}</div>
      <div className={styles.cardDetails}>
        {Object.entries(status.details).slice(0, 3).map(([key, value]) => (
          <div key={key} className={styles.detailItem}>
            <span className={styles.detailKey}>{key}:</span>
            <span className={styles.detailValue}>
              {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Dispatch Intensity Tab Content
function DispatchIntensityContent({
  intensity,
  enabledAssetTypes,
  onIntensityChange,
}: {
  intensity: DispatchIntensitySettings;
  enabledAssetTypes: AssetType[];
  onIntensityChange: (assetType: AssetType, value: number) => void;
}) {
  const getIntensityLabel = (value: number): string => {
    if (value <= 20) return 'Minimal';
    if (value <= 40) return 'Light';
    if (value <= 60) return 'Moderate';
    if (value <= 80) return 'Heavy';
    return 'Maximum';
  };

  const getIntensityColor = (value: number): string => {
    if (value <= 30) return '#22c55e';
    if (value <= 60) return '#eab308';
    return '#ef4444';
  };

  return (
    <div className={styles.aggressivenessContent}>
      <div className={styles.intensityDescription}>
        Controls how aggressively each asset type is dispatched. Higher values mean
        assets are dispatched earlier and pushed harder.
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

      <div className={styles.aggressivenessFooter}>
        <div className={styles.footerHint}>
          <strong>Priority:</strong> Higher intensity = dispatched first
        </div>
        <div className={styles.footerHint}>
          <strong>Utilization:</strong> Higher intensity = more kW per asset
        </div>
      </div>
    </div>
  );
}
