// ============================================
// VPP Simulation Game - Results Summary Generator
// Rule-based logic for generating performance summaries
// ============================================

import {
  EnhancedFinalScore,
  DispatchStrategy,
  SubStrategy,
  GameConfig,
  AssetType,
  ASSET_TYPE_INFO,
  RULE_BASED_SUB_STRATEGIES,
  GREEDY_SUB_STRATEGIES,
  STOCHASTIC_SUB_STRATEGIES,
} from './types';
import { STRATEGY_INFO } from './DispatchStrategies';

export interface ResultsSummary {
  mainParagraph: string;
  strategyFeedback: string;
  assetHighlights: string;
  recommendations: string[];
}

// ---------- Main Summary Generator ----------

export function generateResultsSummary(
  score: EnhancedFinalScore,
  config: GameConfig
): ResultsSummary {
  const strategyFeedback = generateStrategyFeedback(score, config);
  const assetHighlights = generateAssetHighlights(score, config);
  const mainParagraph = generateMainParagraph(score, config, strategyFeedback, assetHighlights);
  const recommendations = generateRecommendations(score, config);

  return {
    mainParagraph,
    strategyFeedback,
    assetHighlights,
    recommendations,
  };
}

// ---------- Main Paragraph ----------

function generateMainParagraph(
  score: EnhancedFinalScore,
  config: GameConfig,
  strategyFeedback: string,
  assetHighlights: string
): string {
  const gradeDescription = getGradeDescription(score.grade);
  const targetPerformance = getTargetPerformanceDescription(score);

  return `${gradeDescription} ${targetPerformance} ${strategyFeedback} ${assetHighlights}`;
}

function getGradeDescription(grade: string): string {
  if (grade.startsWith('A')) {
    return 'Excellent performance!';
  } else if (grade.startsWith('B')) {
    return 'Good performance overall.';
  } else if (grade.startsWith('C')) {
    return 'Moderate performance with room for improvement.';
  } else if (grade.startsWith('D')) {
    return 'Below average performance.';
  } else {
    return 'Performance did not meet expectations.';
  }
}

function getTargetPerformanceDescription(score: EnhancedFinalScore): string {
  const percentMet = score.percentTargetMet;
  const avgVsTarget = score.avgKwVsTarget;

  if (percentMet >= 100) {
    return `Your portfolio consistently exceeded the target by an average of ${Math.abs(avgVsTarget).toFixed(1)} kW per interval.`;
  } else if (percentMet >= 95) {
    return `Your portfolio came very close to meeting the target, achieving ${percentMet.toFixed(1)}% of the required load reduction.`;
  } else if (percentMet >= 80) {
    return `Your portfolio achieved ${percentMet.toFixed(1)}% of the target, falling short by an average of ${Math.abs(avgVsTarget).toFixed(1)} kW per interval.`;
  } else if (percentMet >= 60) {
    return `Your portfolio struggled to meet the target, achieving only ${percentMet.toFixed(1)}% of the required reduction.`;
  } else {
    return `Your portfolio significantly underperformed, achieving only ${percentMet.toFixed(1)}% of the target.`;
  }
}

// ---------- Strategy Feedback ----------

function generateStrategyFeedback(
  score: EnhancedFinalScore,
  config: GameConfig
): string {
  const strategyName = STRATEGY_INFO[config.strategy].name;
  const subStrategyName = getSubStrategyName(config.strategy, config.subStrategy);

  // Evaluate strategy effectiveness based on outcome
  const wasEffective = score.grade.startsWith('A') || score.grade.startsWith('B');
  const hadHighDropoff = score.totalAssetsDropped > score.totalAssetsPerformed * 0.2; // >20% dropped

  let feedback = `The ${strategyName} strategy with "${subStrategyName}" sub-strategy `;

  if (wasEffective && !hadHighDropoff) {
    feedback += 'was well-suited for this scenario.';
  } else if (wasEffective && hadHighDropoff) {
    feedback += 'achieved the target but at the cost of significant asset dropoffs.';
  } else if (!wasEffective && hadHighDropoff) {
    feedback += 'struggled with this scenario, resulting in both target shortfalls and high asset attrition.';
  } else {
    feedback += 'had difficulty optimizing dispatch for this particular asset mix.';
  }

  // Add strategy-specific insights
  feedback += ' ' + getStrategySpecificInsight(config.strategy, config.subStrategy, score);

  return feedback;
}

function getSubStrategyName(strategy: DispatchStrategy, subStrategy: SubStrategy): string {
  switch (strategy) {
    case 'rule_based':
      return RULE_BASED_SUB_STRATEGIES[subStrategy as keyof typeof RULE_BASED_SUB_STRATEGIES]?.name ?? subStrategy;
    case 'greedy':
      return GREEDY_SUB_STRATEGIES[subStrategy as keyof typeof GREEDY_SUB_STRATEGIES]?.name ?? subStrategy;
    case 'stochastic':
      return STOCHASTIC_SUB_STRATEGIES[subStrategy as keyof typeof STOCHASTIC_SUB_STRATEGIES]?.name ?? subStrategy;
  }
}

function getStrategySpecificInsight(
  strategy: DispatchStrategy,
  subStrategy: SubStrategy,
  score: EnhancedFinalScore
): string {
  const batteryPerf = score.assetTypePerformance.find(p => p.assetType === 'battery_resi');
  const hvacPerf = score.assetTypePerformance.find(p => p.assetType === 'hvac_resi');
  const evPerf = score.assetTypePerformance.find(p => p.assetType === 'ev_resi');

  switch (strategy) {
    case 'rule_based':
      if (subStrategy === 'batteries_first' && batteryPerf && batteryPerf.complianceRate < 80) {
        return 'Batteries were depleted quickly, leaving limited flexibility for later intervals.';
      } else if (subStrategy === 'hvac_first' && hvacPerf && hvacPerf.complianceRate < 80) {
        return 'HVAC assets reached comfort limits, causing early dropoffs.';
      } else if (subStrategy === 'load_reduction_first' && evPerf && evPerf.complianceRate < 80) {
        return 'EV charging constraints limited the effectiveness of load reduction prioritization.';
      }
      return 'The priority ordering helped balance load across asset types.';

    case 'greedy':
      if (subStrategy === 'max_capacity' && score.totalAssetsDropped > 5) {
        return 'Aggressively dispatching high-capacity assets led to faster exhaustion.';
      } else if (subStrategy === 'lowest_risk') {
        return 'Conservative asset selection helped maintain portfolio stability.';
      }
      return 'Greedy optimization effectively maximized short-term output.';

    case 'stochastic':
      if (subStrategy === 'risk_averse' && score.totalAssetsDropped < 3) {
        return 'The risk-averse approach successfully minimized asset dropoffs.';
      } else if (subStrategy === 'opportunity_seeking' && score.percentTargetMet > 95) {
        return 'Taking calculated risks paid off with strong target achievement.';
      }
      return 'Probabilistic modeling helped navigate uncertainty in asset availability.';

    default:
      return '';
  }
}

// ---------- Asset Highlights ----------

function generateAssetHighlights(
  score: EnhancedFinalScore,
  config: GameConfig
): string {
  const activeAssets = score.assetTypePerformance.filter(p => p.totalDispatched > 0);

  if (activeAssets.length === 0) {
    return 'No assets were dispatched during this event.';
  }

  const mostDispatched = ASSET_TYPE_INFO[score.mostDispatchedAssetType];
  const best = ASSET_TYPE_INFO[score.bestPerformingAssetType];
  const worst = ASSET_TYPE_INFO[score.worstPerformingAssetType];

  const bestPerf = score.assetTypePerformance.find(p => p.assetType === score.bestPerformingAssetType);
  const worstPerf = score.assetTypePerformance.find(p => p.assetType === score.worstPerformingAssetType);

  let highlights = `${mostDispatched.name} assets were dispatched most frequently across the portfolio.`;

  // Best performer insight
  if (bestPerf && bestPerf.complianceRate >= 90) {
    highlights += ` ${best.name} showed excellent reliability with ${bestPerf.complianceRate.toFixed(0)}% compliance`;
    highlights += getBestPerformerReason(score.bestPerformingAssetType);
  } else if (bestPerf) {
    highlights += ` ${best.name} performed best among asset types with ${bestPerf.complianceRate.toFixed(0)}% compliance.`;
  }

  // Worst performer insight (only if different from best and has issues)
  if (score.bestPerformingAssetType !== score.worstPerformingAssetType && worstPerf && worstPerf.complianceRate < 80) {
    highlights += ` ${worst.name} had the most challenges with only ${worstPerf.complianceRate.toFixed(0)}% compliance`;
    highlights += getWorstPerformerReason(score.worstPerformingAssetType, worstPerf);
  }

  return highlights;
}

function getBestPerformerReason(assetType: AssetType): string {
  switch (assetType) {
    case 'hvac_resi':
      return ', likely due to favorable outdoor temperatures keeping comfort within bounds.';
    case 'battery_resi':
      return ', as battery storage provided consistent and controllable output.';
    case 'ev_resi':
      return ', with EV owners accepting the reduced charging rates.';
    case 'fleet_site':
      return ', as fleet charging schedules aligned well with event timing.';
    case 'ci_building':
      return ', with commercial buildings successfully shedding load without operational impact.';
    default:
      return '.';
  }
}

function getWorstPerformerReason(assetType: AssetType, perf: { totalDropped: number }): string {
  switch (assetType) {
    case 'hvac_resi':
      return `, as indoor temperatures likely breached comfort limits, triggering customer overrides.`;
    case 'battery_resi':
      return `, likely due to depleted state-of-charge hitting reserve thresholds.`;
    case 'ev_resi':
      return `, as departure deadlines forced charging to resume before the event ended.`;
    case 'fleet_site':
      return `, with fleet vehicle schedules conflicting with dispatch requirements.`;
    case 'ci_building':
      return `, as HVAC fatigue and process load constraints limited sustained participation.`;
    default:
      return '.';
  }
}

// ---------- Recommendations ----------

function generateRecommendations(
  score: EnhancedFinalScore,
  config: GameConfig
): string[] {
  const recommendations: string[] = [];

  // Grade-based recommendations
  if (score.grade.startsWith('D') || score.grade === 'F') {
    recommendations.push('Consider lowering the difficulty level to build familiarity with dispatch mechanics.');
  }

  // Dropoff-based recommendations
  const dropoffRate = score.totalAssetsDropped / (score.totalAssetsPerformed + score.totalAssetsDropped);
  if (dropoffRate > 0.3) {
    recommendations.push('High asset dropoff suggests overly aggressive dispatch. Try reducing aggressiveness sliders.');
  }

  // Strategy-specific recommendations
  if (config.strategy === 'rule_based' && score.percentTargetMet < 80) {
    recommendations.push('Rule-based strategies work best with diverse asset portfolios. Consider enabling more asset types.');
  }

  if (config.strategy === 'greedy' && score.totalAssetsDropped > 5) {
    recommendations.push('Try the "Lowest Risk" sub-strategy to reduce asset attrition.');
  }

  if (config.strategy === 'stochastic' && score.percentTargetMet < 90) {
    recommendations.push('Stochastic strategies benefit from larger asset pools. Consider increasing difficulty for more assets.');
  }

  // Asset-specific recommendations
  const hvacPerf = score.assetTypePerformance.find(p => p.assetType === 'hvac_resi');
  if (hvacPerf && hvacPerf.complianceRate < 70) {
    recommendations.push('HVAC assets are struggling. Try reducing HVAC aggressiveness to stay within comfort bounds.');
  }

  const batteryPerf = score.assetTypePerformance.find(p => p.assetType === 'battery_resi');
  if (batteryPerf && batteryPerf.complianceRate < 70) {
    recommendations.push('Batteries are depleting too quickly. Consider pacing discharge with lower aggressiveness.');
  }

  // Limit to top 3 recommendations
  return recommendations.slice(0, 3);
}
