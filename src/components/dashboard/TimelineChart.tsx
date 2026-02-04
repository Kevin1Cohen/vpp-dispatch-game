// ============================================
// Timeline Chart Component
// Line chart showing power over time
// ============================================

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
import { TimestepResult } from '../../game/types';
import styles from './TimelineChart.module.css';

interface TimelineChartProps {
  history: TimestepResult[];
  targetKw: number;
}

export function TimelineChart({ history, targetKw }: TimelineChartProps) {
  const data = history.map((h) => ({
    time: h.time,
    achieved: h.achieved_kw,
    target: h.target_kw,
    temp: h.outdoor_temp_f,
  }));

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Power Delivery Timeline</h3>
      <div className={styles.chartWrapper}>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
              tickFormatter={(value) => `${value}`}
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
                `${Number(value).toFixed(1)} kW`,
                name === 'achieved' ? 'Achieved' : 'Target',
              ]}
            />
            <ReferenceLine
              y={targetKw}
              stroke="#475569"
              strokeDasharray="5 5"
              label={{
                value: 'Target',
                fill: '#64748b',
                fontSize: 10,
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
            />
            <Line
              type="monotone"
              dataKey="target"
              stroke="#64748b"
              strokeWidth={1}
              strokeDasharray="5 5"
              dot={false}
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
            style={{ background: '#64748b', backgroundImage: 'repeating-linear-gradient(90deg, #64748b 0, #64748b 4px, transparent 4px, transparent 8px)' }}
          />
          <span>Target</span>
        </div>
      </div>
    </div>
  );
}
