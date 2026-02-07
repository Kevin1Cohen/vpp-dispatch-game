// ============================================
// VPP Simulation Game - Welcome Screen
// ============================================

import { useGame } from '../../context/GameContext';
import styles from './WelcomeScreen.module.css';

export function WelcomeScreen() {
  const { goToScreen } = useGame();

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.iconWrapper}>
          <span className={styles.icon}>⚡</span>
        </div>

        <h1 className={styles.title}>Virtual Power Plant</h1>
        <h2 className={styles.subtitle}>Simulation Game</h2>

        <p className={styles.description}>
          Take command of a distributed energy resource portfolio.
          Coordinate residential batteries, smart thermostats, EV chargers,
          and commercial buildings to meet grid demand targets during peak events.
        </p>

        <div className={styles.features}>
          <div className={styles.feature}>
            <span className={styles.featureIcon}>🎯</span>
            <span>Strategic asset dispatch</span>
          </div>
          <div className={styles.feature}>
            <span className={styles.featureIcon}>📊</span>
            <span>Real-time performance tracking</span>
          </div>
          <div className={styles.feature}>
            <span className={styles.featureIcon}>🔋</span>
            <span>Multi-asset portfolio management</span>
          </div>
        </div>

        <button
          className={styles.startButton}
          onClick={() => goToScreen('rules')}
        >
          Start Game
          <span className={styles.arrow}>→</span>
        </button>
      </div>

      <footer className={styles.footer}>
        <p>A simulation of Virtual Power Plant operations</p>
      </footer>
    </div>
  );
}
