// ============================================
// Asset Panel Component
// Grid of asset status cards
// ============================================

import { useState } from 'react';
import { Asset, ASSET_TYPE_INFO, AssetType } from '../../game/types';
import { getAssetStatus, AssetStatus } from '../../game/AssetModels';
import styles from './AssetPanel.module.css';

interface AssetPanelProps {
  assets: Asset[];
}

export function AssetPanel({ assets }: AssetPanelProps) {
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
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Asset Status</h3>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={showDropped}
            onChange={(e) => setShowDropped(e.target.checked)}
          />
          <span>Show dropped</span>
        </label>
      </div>

      <div className={styles.filters}>
        <button
          className={`${styles.filterButton} ${filter === 'all' ? styles.active : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({typeCounts.all.total})
        </button>
        {(Object.keys(ASSET_TYPE_INFO) as AssetType[]).map((type) => (
          typeCounts[type].total > 0 && (
            <button
              key={type}
              className={`${styles.filterButton} ${filter === type ? styles.active : ''}`}
              onClick={() => setFilter(type)}
            >
              {ASSET_TYPE_INFO[type].icon} {typeCounts[type].total}
            </button>
          )
        ))}
      </div>

      <div className={styles.grid}>
        {assetStatuses.slice(0, 50).map((status) => (
          <AssetCard key={status.id} status={status} />
        ))}
      </div>

      {assetStatuses.length > 50 && (
        <p className={styles.overflow}>
          Showing 50 of {assetStatuses.length} assets
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
