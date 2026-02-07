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
          <h2 className={styles.sectionTitle}>What are Virtual Power Plants?</h2>
          <p className={styles.text}>
            A <strong>Virtual Power Plant (VPP)</strong> is a network of distributed energy resources—such
            as residential batteries, smart thermostats, electric vehicles, and commercial building
            systems—that are coordinated to act as a single, flexible power resource.
          </p>
          <p className={styles.text}>
            Unlike traditional power plants that generate electricity at a central location, VPPs
            aggregate thousands of smaller assets across homes, businesses, and communities. Through
            intelligent software and real-time coordination, these distributed resources can reduce
            demand during peak hours, store and release energy when needed, and help balance the grid.
          </p>
          <div className={styles.importanceBox}>
            <h3 className={styles.importanceTitle}>Why VPPs Matter</h3>
            <ul className={styles.importanceList}>
              <li><strong>Grid Stability:</strong> VPPs provide rapid response to demand spikes, reducing strain on the electrical grid during extreme weather or peak usage periods.</li>
              <li><strong>Renewable Integration:</strong> By shifting demand and storing excess energy, VPPs help integrate intermittent solar and wind power more effectively.</li>
              <li><strong>Cost Reduction:</strong> VPPs can defer expensive infrastructure upgrades and reduce reliance on costly peaker plants that only run during high-demand periods.</li>
              <li><strong>Consumer Empowerment:</strong> Homeowners and businesses can monetize their devices by participating in grid services, earning incentives while supporting clean energy.</li>
            </ul>
          </div>
        </section>

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
            <code>penalty(t) = (|achieved - target| / target)ⁿ</code>
          </div>
          <p className={styles.text}>
            Each timestep, you accumulate a penalty based on deviation from the target—both
            underperformance and overperformance are penalized. The exponent (n) varies by
            difficulty, so large deviations are punished exponentially. Your final score is
            the sum of all penalties. Aim for precision, not just hitting the target.
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
                <p>Assets accumulate fatigue when continuously dispatched—homeowners, businesses, and fleet operators may reduce participation or drop out if pushed too long.</p>
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
          <h2 className={styles.sectionTitle}>Dispatch Strategy System</h2>
          <p className={styles.text}>
            Build your dispatch strategy by choosing options from four key dimensions:
          </p>

          <div className={styles.strategyDimensions}>
            <div className={styles.dimension}>
              <h4 className={styles.dimensionTitle}>1. Decision Framework</h4>
              <p className={styles.dimensionDesc}>How dispatch decisions are computed:</p>
              <ul className={styles.dimensionList}>
                <li><strong>Deterministic Policy:</strong> Fixed rules based on asset priority or event phase. Predictable and auditable.</li>
                <li><strong>Greedy/Myopic:</strong> Optimizes for immediate results without long-term planning. Fast but may cause issues later.</li>
                <li><strong>Stochastic:</strong> Models uncertainty using sampling. Robust to variability in asset response.</li>
                <li><strong>Feedback Control:</strong> Real-time error correction. Adapts dispatch based on actual performance vs target.</li>
              </ul>
            </div>

            <div className={styles.dimension}>
              <h4 className={styles.dimensionTitle}>2. Objective Function</h4>
              <p className={styles.dimensionDesc}>What you're optimizing for:</p>
              <ul className={styles.dimensionList}>
                <li><strong>Capacity:</strong> Maximize probability of hitting MW targets.</li>
                <li><strong>Risk Minimization:</strong> Minimize variance and failure probability.</li>
                <li><strong>Efficiency:</strong> Maximize kW delivered per unit of customer impact.</li>
                <li><strong>Regret Minimization:</strong> Avoid catastrophic failures at all costs.</li>
              </ul>
            </div>

            <div className={styles.dimension}>
              <h4 className={styles.dimensionTitle}>3. Risk Posture</h4>
              <p className={styles.dimensionDesc}>How aggressively you trade risk for performance:</p>
              <ul className={styles.dimensionList}>
                <li><strong>Risk Averse:</strong> High reserves, early dispatch, conservative approach.</li>
                <li><strong>Neutral:</strong> Balanced risk and reward.</li>
                <li><strong>Opportunity Seeking:</strong> Lower reserves, delayed dispatch, aggressive optimization.</li>
                <li><strong>Deadline Aware:</strong> Becomes increasingly aggressive as the event progresses.</li>
              </ul>
            </div>

            <div className={styles.dimension}>
              <h4 className={styles.dimensionTitle}>4. Asset Selection Order</h4>
              <p className={styles.dimensionDesc}>How assets are prioritized for dispatch:</p>
              <ul className={styles.dimensionList}>
                <li><strong>Type-Based:</strong> Batteries first, HVAC first, or balanced across types.</li>
                <li><strong>Performance-Based:</strong> Prioritize reliable assets with good historical delivery.</li>
                <li><strong>State-Based:</strong> Dispatch assets with highest headroom or lowest comfort cost.</li>
                <li><strong>Fairness-Based:</strong> Spread dispatch load evenly over time to reduce fatigue.</li>
              </ul>
            </div>
          </div>

          <div className={styles.strategyTip}>
            <span className={styles.tipIcon}>💡</span>
            <p>
              <strong>Tip:</strong> You can select up to 3 ordering criteria. The first has the most weight.
              Experiment with different combinations to find what works best for each difficulty level!
            </p>
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
