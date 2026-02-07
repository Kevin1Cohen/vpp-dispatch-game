// ============================================
// Playback Controls Component
// Play/pause, speed, and step controls
// ============================================

import styles from './PlaybackControls.module.css';

interface PlaybackControlsProps {
  isRunning: boolean;
  isComplete: boolean;
  speed: number;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onStep: () => void;
  onSpeedChange: (speed: number) => void;
}

const SPEED_OPTIONS = [0.5, 1, 2, 5, 10];

export function PlaybackControls({
  isRunning,
  isComplete,
  speed,
  onPlay,
  onPause,
  onReset,
  onStep,
  onSpeedChange,
}: PlaybackControlsProps) {
  return (
    <div className={styles.container}>
      <div className={styles.mainControls}>
        <button
          className={styles.controlButton}
          onClick={onReset}
          title="Reset"
        >
          ⏮
        </button>

        {isRunning ? (
          <button
            className={`${styles.controlButton} ${styles.primary}`}
            onClick={onPause}
            title="Pause"
          >
            ⏸
          </button>
        ) : (
          <button
            className={`${styles.controlButton} ${styles.primary}`}
            onClick={onPlay}
            disabled={isComplete}
            title="Play"
          >
            ▶
          </button>
        )}

        <button
          className={styles.controlButton}
          onClick={onStep}
          disabled={isRunning || isComplete}
          title="Step Forward"
        >
          ⏭
        </button>
      </div>

      <div className={styles.speedControls}>
        <span className={styles.speedLabel}>Speed:</span>
        <div className={styles.speedButtons}>
          {SPEED_OPTIONS.map((s) => (
            <button
              key={s}
              className={`${styles.speedButton} ${speed === s ? styles.active : ''}`}
              onClick={() => onSpeedChange(s)}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
