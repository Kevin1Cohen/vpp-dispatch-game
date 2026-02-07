// ============================================
// Timeline Chart Component
// Tabbed view: Load Reduction, Dispatched Assets, and Dispatch Calls
// ============================================

import { useState, ReactNode } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { TimestepResult, ASSET_TYPE_INFO } from '../../game/types';
import styles from './TimelineChart.module.css';

interface TimelineChartProps {
  history: TimestepResult[];
  targetKw: number;
  children?: ReactNode; // For playback controls
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

// Determine best unit for display based on target
function getUnit(targetKw: number): { divisor: number; label: string } {
  if (targetKw >= 1000000) {
    return { divisor: 1000000, label: 'GW' };
  } else if (targetKw >= 1000) {
    return { divisor: 1000, label: 'MW' };
  }
  return { divisor: 1, label: 'kW' };
}

// Asset type colors for the dispatch chart
const ASSET_COLORS: Record<string, string> = {
  hvac_resi: '#f97316',    // Orange
  battery_resi: '#22c55e', // Green
  ev_resi: '#3b82f6',      // Blue
  fleet_site: '#a855f7',   // Purple
  ci_building: '#ec4899',  // Pink
};

export function TimelineChart({ history, targetKw, children }: TimelineChartProps) {
  const [activeTab, setActiveTab] = useState<'loadReduction' | 'dispatches' | 'dispatchCalls'>('loadReduction');
  const unit = getUnit(targetKw);

  // Data for load reduction chart
  const loadData = history.map((h) => ({
    time: h.time,
    achieved: h.achieved_kw / unit.divisor,
    target: h.target_kw / unit.divisor,
    temp: h.outdoor_temp_f,
  }));

  // Data for dispatches chart (total active dispatches)
  const dispatchData = history.map((h) => ({
    time: h.time,
    hvac_resi: h.dispatches_by_type?.hvac_resi ?? 0,
    battery_resi: h.dispatches_by_type?.battery_resi ?? 0,
    ev_resi: h.dispatches_by_type?.ev_resi ?? 0,
    fleet_site: h.dispatches_by_type?.fleet_site ?? 0,
    ci_building: h.dispatches_by_type?.ci_building ?? 0,
  }));

  // Data for new dispatch calls chart (only NEW dispatches per timestep)
  const dispatchCallsData = history.map((h) => ({
    time: h.time,
    hvac_resi: h.new_dispatch_calls?.hvac_resi ?? 0,
    battery_resi: h.new_dispatch_calls?.battery_resi ?? 0,
    ev_resi: h.new_dispatch_calls?.ev_resi ?? 0,
    fleet_site: h.new_dispatch_calls?.fleet_site ?? 0,
    ci_building: h.new_dispatch_calls?.ci_building ?? 0,
  }));

  // Format large numbers with K suffix
  const formatDispatchCount = (value: number): string => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toString();
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'loadReduction' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('loadReduction')}
          >
            Load Reduction
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'dispatches' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('dispatches')}
          >
            Active Dispatches
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'dispatchCalls' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('dispatchCalls')}
          >
            New Dispatch Calls
          </button>
        </div>
      </div>

      {activeTab === 'loadReduction' && (
        <>
          <div className={styles.chartWrapper}>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={loadData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="time"
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  domain={[0, 'auto']}
                  tickFormatter={(value) => `${value} ${unit.label}`}
                />
                <Tooltip
                  contentStyle={{
                    background: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '8px',
                    color: '#f8fafc',
                  }}
                  labelStyle={{ color: '#94a3b8' }}
                  formatter={(value, name) => [
                    `${Number(value).toFixed(1)} ${unit.label}`,
                    name === 'achieved' ? 'Achieved' : 'Target',
                  ]}
                />
                <ReferenceLine
                  y={targetKw / unit.divisor}
                  stroke="#eab308"
                  strokeWidth={2}
                  strokeDasharray="8 4"
                  label={{
                    value: 'Target',
                    fill: '#eab308',
                    fontSize: 11,
                    fontWeight: 600,
                    position: 'right',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="achieved"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#22c55e' }}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="target"
                  stroke="#eab308"
                  strokeWidth={1.5}
                  strokeDasharray="6 3"
                  dot={false}
                  opacity={0.7}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className={styles.legend}>
            <div className={styles.legendItem}>
              <span className={styles.legendLine} style={{ background: '#22c55e' }} />
              <span>Achieved</span>
            </div>
            <div className={styles.legendItem}>
              <span
                className={styles.legendLine}
                style={{ background: '#eab308', backgroundImage: 'repeating-linear-gradient(90deg, #eab308 0, #eab308 4px, transparent 4px, transparent 8px)' }}
              />
              <span>Target</span>
            </div>
          </div>
        </>
      )}

      {activeTab === 'dispatches' && (
        <>
          <div className={styles.chartWrapper}>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={dispatchData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="time"
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  domain={[0, 'auto']}
                  tickFormatter={formatDispatchCount}
                />
                <Tooltip
                  contentStyle={{
                    background: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '8px',
                    color: '#f8fafc',
                  }}
                  labelStyle={{ color: '#94a3b8' }}
                  formatter={(value, name) => {
                    const assetInfo = ASSET_TYPE_INFO[name as keyof typeof ASSET_TYPE_INFO];
                    return [
                      `${Number(value).toLocaleString()} active`,
                      assetInfo?.name ?? name,
                    ];
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="hvac_resi"
                  stroke={ASSET_COLORS.hvac_resi}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="battery_resi"
                  stroke={ASSET_COLORS.battery_resi}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="ev_resi"
                  stroke={ASSET_COLORS.ev_resi}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="fleet_site"
                  stroke={ASSET_COLORS.fleet_site}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="ci_building"
                  stroke={ASSET_COLORS.ci_building}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className={styles.legend}>
            <div className={styles.legendItem}>
              <span className={styles.legendLine} style={{ background: ASSET_COLORS.hvac_resi }} />
              <span>HVAC</span>
            </div>
            <div className={styles.legendItem}>
              <span className={styles.legendLine} style={{ background: ASSET_COLORS.battery_resi }} />
              <span>Battery</span>
            </div>
            <div className={styles.legendItem}>
              <span className={styles.legendLine} style={{ background: ASSET_COLORS.ev_resi }} />
              <span>EV</span>
            </div>
            <div className={styles.legendItem}>
              <span className={styles.legendLine} style={{ background: ASSET_COLORS.fleet_site }} />
              <span>Fleet</span>
            </div>
            <div className={styles.legendItem}>
              <span className={styles.legendLine} style={{ background: ASSET_COLORS.ci_building }} />
              <span>C&I</span>
            </div>
          </div>
        </>
      )}

      {activeTab === 'dispatchCalls' && (
        <>
          <div className={styles.chartWrapper}>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={dispatchCallsData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="time"
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  domain={[0, 'auto']}
                  tickFormatter={formatDispatchCount}
                />
                <Tooltip
                  contentStyle={{
                    background: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '8px',
                    color: '#f8fafc',
                  }}
                  labelStyle={{ color: '#94a3b8' }}
                  formatter={(value, name) => {
                    const assetInfo = ASSET_TYPE_INFO[name as keyof typeof ASSET_TYPE_INFO];
                    return [
                      `${Number(value).toLocaleString()} new calls`,
                      assetInfo?.name ?? name,
                    ];
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="hvac_resi"
                  stroke={ASSET_COLORS.hvac_resi}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="battery_resi"
                  stroke={ASSET_COLORS.battery_resi}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="ev_resi"
                  stroke={ASSET_COLORS.ev_resi}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="fleet_site"
                  stroke={ASSET_COLORS.fleet_site}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="ci_building"
                  stroke={ASSET_COLORS.ci_building}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className={styles.legend}>
            <div className={styles.legendItem}>
              <span className={styles.legendLine} style={{ background: ASSET_COLORS.hvac_resi }} />
              <span>HVAC</span>
            </div>
            <div className={styles.legendItem}>
              <span className={styles.legendLine} style={{ background: ASSET_COLORS.battery_resi }} />
              <span>Battery</span>
            </div>
            <div className={styles.legendItem}>
              <span className={styles.legendLine} style={{ background: ASSET_COLORS.ev_resi }} />
              <span>EV</span>
            </div>
            <div className={styles.legendItem}>
              <span className={styles.legendLine} style={{ background: ASSET_COLORS.fleet_site }} />
              <span>Fleet</span>
            </div>
            <div className={styles.legendItem}>
              <span className={styles.legendLine} style={{ background: ASSET_COLORS.ci_building }} />
              <span>C&I</span>
            </div>
          </div>
        </>
      )}

      {/* Playback controls slot */}
      {children && (
        <div className={styles.controlsSlot}>
          {children}
        </div>
      )}
    </div>
  );
}
