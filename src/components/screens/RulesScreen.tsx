// ============================================
// VPP Simulation Game - Rules Screen
// ============================================

import { useGame } from '../../context/GameContext';
import { ASSET_TYPE_INFO } from '../../game/types';
import styles from './RulesScreen.module.css';

export function RulesScreen() {
  const { goToScreen } = useGame();

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <button className={styles.backButton} onClick={() => goToScreen('welcome')}>
          ← Back
        </button>

        <h1 className={styles.title}>How to Play</h1>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Objective</h2>
          <p className={styles.text}>
            Your goal is to meet a target kW reduction during a demand response event
            by coordinating a portfolio of distributed energy resources. Minimize your
            penalty score by keeping your achieved reduction as close to the target as possible.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Scoring</h2>
          <div className={styles.formula}>
            <code>penalty(t) = (shortfall / target)²</code>
          </div>
          <p className={styles.text}>
            Each timestep, if you fall short of the target, you accumulate a penalty.
            The penalty grows quadratically with the shortfall, so large misses are
            punished more than small ones. Your final score is the sum of all penalties.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Asset Types</h2>
          <div className={styles.assetGrid}>
            {Object.entries(ASSET_TYPE_INFO).map(([type, info]) => (
              <div key={type} className={styles.assetCard}>
                <span className={styles.assetIcon}>{info.icon}</span>
                <div className={styles.assetInfo}>
                  <h3 className={styles.assetName}>{info.name}</h3>
                  <p className={styles.assetDesc}>{info.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Key Mechanics</h2>
          <div className={styles.mechanicsList}>
            <div className={styles.mechanic}>
              <span className={styles.mechanicIcon}>⚠️</span>
              <div>
                <h4>Drop-offs</h4>
                <p>Assets may drop out if pushed too hard (comfort violations, depleted batteries, deadline pressure).</p>
              </div>
            </div>
            <div className={styles.mechanic}>
              <span className={styles.mechanicIcon}>🎲</span>
              <div>
                <h4>Noncompliance</h4>
                <p>Some assets may ignore commands due to random noncompliance events.</p>
              </div>
            </div>
            <div className={styles.mechanic}>
              <span className={styles.mechanicIcon}>📉</span>
              <div>
                <h4>Fatigue</h4>
                <p>C&I buildings accumulate fatigue when shedding HVAC load, reducing available capacity over time.</p>
              </div>
            </div>
            <div className={styles.mechanic}>
              <span className={styles.mechanicIcon}>🔄</span>
              <div>
                <h4>Overrides</h4>
                <p>EVs will override your commands if they risk missing their departure deadline.</p>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Dispatch Strategies</h2>
          <div className={styles.strategiesList}>
            <div className={styles.strategy}>
              <h4>Rule-Based</h4>
              <p>Follows a fixed priority order. Balanced and predictable.</p>
            </div>
            <div className={styles.strategy}>
              <h4>Greedy</h4>
              <p>Maximizes immediate reduction. High performance but risks drop-offs.</p>
            </div>
            <div className={styles.strategy}>
              <h4>Stochastic</h4>
              <p>Accounts for uncertainty. Conservative early, aggressive late.</p>
            </div>
          </div>
        </section>

        <div className={styles.buttonWrapper}>
          <button
            className={styles.continueButton}
            onClick={() => goToScreen('setup')}
          >
            Begin Setup
            <span className={styles.arrow}>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
