// ============================================
// VPP Simulation Game - Results Summary Generator
// Rule-based logic for generating performance summaries
// Updated for Composable Strategy System
// ============================================

import {
  EnhancedFinalScore,
  GameConfig,
  AssetType,
  ASSET_TYPE_INFO,
  DecisionFramework,
  ObjectiveFunction,
  RiskPosture,
  SelectionOrdering,
  DECISION_FRAMEWORK_INFO,
  OBJECTIVE_FUNCTION_INFO,
  RISK_POSTURE_INFO,
  SELECTION_ORDERING_INFO,
  StrategyConfig,
} from './types';

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

// ---------- Strategy Feedback (Updated for Composable System) ----------

function generateStrategyFeedback(
  score: EnhancedFinalScore,
  config: GameConfig
): string {
  const strategyConfig = config.strategyConfig;

  // Get display names
  const frameworkInfo = DECISION_FRAMEWORK_INFO[strategyConfig.decisionFramework];
  const objectiveInfo = OBJECTIVE_FUNCTION_INFO[strategyConfig.objective];
  const riskInfo = RISK_POSTURE_INFO[strategyConfig.riskPosture];

  // Evaluate strategy effectiveness
  const wasEffective = score.grade.startsWith('A') || score.grade.startsWith('B');
  const hadHighDropoff = score.totalAssetsDropped > score.totalAssetsPerformed * 0.2;
  const wasStable = score.totalAssetsDropped < 3;

  let feedback = '';

  // Framework-specific opening
  feedback += getFrameworkFeedback(strategyConfig.decisionFramework, wasEffective, score);

  // Objective alignment assessment
  feedback += ' ' + getObjectiveFeedback(strategyConfig.objective, score, hadHighDropoff);

  // Risk posture assessment
  feedback += ' ' + getRiskPostureFeedback(strategyConfig.riskPosture, wasStable, wasEffective, score);

  // Selection ordering feedback
  feedback += ' ' + getSelectionOrderingFeedback(strategyConfig.selectionOrderings, score);

  return feedback;
}

function getFrameworkFeedback(
  framework: DecisionFramework,
  wasEffective: boolean,
  score: EnhancedFinalScore
): string {
  const frameworkInfo = DECISION_FRAMEWORK_INFO[framework];

  switch (framework) {
    case 'deterministic_policy':
      if (wasEffective) {
        return `The ${frameworkInfo.name} framework provided predictable, auditable dispatch decisions that successfully met the target.`;
      } else {
        return `The ${frameworkInfo.name} framework's fixed rules struggled to adapt to changing conditions during the event.`;
      }

    case 'greedy_myopic':
      if (wasEffective && score.totalAssetsDropped < 5) {
        return `The ${frameworkInfo.name} approach effectively maximized short-term gains without causing excessive asset fatigue.`;
      } else if (wasEffective) {
        return `The ${frameworkInfo.name} approach hit the target but pushed assets hard, causing dropoffs.`;
      } else {
        return `The ${frameworkInfo.name} approach's focus on immediate optimization led to resource exhaustion before the event concluded.`;
      }

    case 'stochastic':
      if (wasEffective) {
        return `The ${frameworkInfo.name} framework's probabilistic modeling successfully navigated uncertainty in asset availability.`;
      } else {
        return `The ${frameworkInfo.name} framework's sampling approach may have been too conservative or variance was higher than anticipated.`;
      }

    case 'feedback_control':
      const avgDeviation = Math.abs(score.avgKwVsTarget);
      if (avgDeviation < 50) {
        return `The ${frameworkInfo.name} framework maintained tight control with minimal deviation from target throughout the event.`;
      } else if (wasEffective) {
        return `The ${frameworkInfo.name} framework successfully corrected deviations in real-time to stay on target.`;
      } else {
        return `The ${frameworkInfo.name} framework struggled to correct accumulated errors during the event.`;
      }

    default:
      return `The dispatch framework was applied to coordinate your asset portfolio.`;
  }
}

function getObjectiveFeedback(
  objective: ObjectiveFunction,
  score: EnhancedFinalScore,
  hadHighDropoff: boolean
): string {
  const objectiveInfo = OBJECTIVE_FUNCTION_INFO[objective];

  switch (objective) {
    case 'capacity':
      if (score.percentTargetMet >= 95) {
        return `Optimizing for ${objectiveInfo.name.toLowerCase()} paid off with ${score.percentTargetMet.toFixed(0)}% target achievement.`;
      } else {
        return `Despite optimizing for ${objectiveInfo.name.toLowerCase()}, the portfolio fell short of the MW target.`;
      }

    case 'risk_minimization':
      if (!hadHighDropoff) {
        return `The ${objectiveInfo.name.toLowerCase()} objective successfully preserved portfolio stability with minimal dropoffs.`;
      } else {
        return `Even with ${objectiveInfo.name.toLowerCase()}, some assets exceeded their operational limits.`;
      }

    case 'efficiency':
      const avgCompliance = score.assetTypePerformance.reduce((sum, p) => sum + p.complianceRate, 0) / score.assetTypePerformance.length;
      if (avgCompliance >= 85) {
        return `The ${objectiveInfo.name.toLowerCase()} objective achieved high asset utilization with ${avgCompliance.toFixed(0)}% average compliance.`;
      } else {
        return `The ${objectiveInfo.name.toLowerCase()} objective showed room for improvement in balancing dispatch across assets.`;
      }

    case 'regret_minimization':
      if (score.grade.startsWith('A') || score.grade.startsWith('B') || score.grade.startsWith('C')) {
        return `The ${objectiveInfo.name.toLowerCase()} approach avoided catastrophic failures.`;
      } else {
        return `Despite the ${objectiveInfo.name.toLowerCase()} approach, performance fell significantly below expectations.`;
      }

    case 'learning_oriented':
      return `The ${objectiveInfo.name.toLowerCase()} objective gathered valuable data on asset performance for future optimization.`;

    default:
      return '';
  }
}

function getRiskPostureFeedback(
  riskPosture: RiskPosture,
  wasStable: boolean,
  wasEffective: boolean,
  score: EnhancedFinalScore
): string {
  const riskInfo = RISK_POSTURE_INFO[riskPosture];

  switch (riskPosture) {
    case 'risk_averse':
      if (wasStable && !wasEffective) {
        return `The ${riskInfo.name.toLowerCase()} posture preserved assets but may have been too conservative to hit the target.`;
      } else if (wasStable && wasEffective) {
        return `The ${riskInfo.name.toLowerCase()} posture successfully balanced target achievement with asset preservation.`;
      } else {
        return `Despite the ${riskInfo.name.toLowerCase()} posture, challenging conditions led to some asset constraints.`;
      }

    case 'neutral':
      return `The ${riskInfo.name.toLowerCase()} risk posture provided balanced dispatch timing and reserve margins.`;

    case 'opportunity_seeking':
      if (wasEffective) {
        return `The ${riskInfo.name.toLowerCase()} posture's aggressive optimization successfully maximized delivery.`;
      } else if (!wasStable) {
        return `The ${riskInfo.name.toLowerCase()} posture pushed assets too aggressively, causing dropoffs that impacted overall performance.`;
      } else {
        return `The ${riskInfo.name.toLowerCase()} posture may have delayed dispatch too long, missing early opportunities.`;
      }

    case 'deadline_aware':
      // Check if performance improved over time (approximated by looking at later intervals)
      if (wasEffective) {
        return `The ${riskInfo.name.toLowerCase()} posture effectively ramped up intensity as the event progressed.`;
      } else {
        return `The ${riskInfo.name.toLowerCase()} posture's late-stage acceleration wasn't enough to recover from early shortfalls.`;
      }

    default:
      return '';
  }
}

function getSelectionOrderingFeedback(
  orderings: SelectionOrdering[],
  score: EnhancedFinalScore
): string {
  if (orderings.length === 0) return '';

  const primaryOrdering = orderings[0];
  const orderingInfo = SELECTION_ORDERING_INFO[primaryOrdering];

  // Analyze which asset types performed best/worst
  const bestPerf = score.assetTypePerformance.find(p => p.assetType === score.bestPerformingAssetType);
  const worstPerf = score.assetTypePerformance.find(p => p.assetType === score.worstPerformingAssetType);

  // Check if ordering aligned with results
  const orderingCategory = orderingInfo.category;

  if (orderingCategory === 'performance_based' && bestPerf && bestPerf.complianceRate >= 90) {
    return `Prioritizing by ${orderingInfo.name.toLowerCase()} helped leverage high-performing assets effectively.`;
  } else if (orderingCategory === 'state_based') {
    return `${orderingInfo.name} selection optimized dispatch based on real-time asset conditions.`;
  } else if (orderingCategory === 'fairness_based' && score.totalAssetsDropped < 3) {
    return `The ${orderingInfo.name.toLowerCase()} approach helped distribute load and minimize fatigue.`;
  } else if (orderingCategory === 'asset_type_based') {
    return `Type-based ordering (${orderingInfo.name}) provided structured dispatch across the portfolio.`;
  }

  if (orderings.length > 1) {
    const secondaryInfo = SELECTION_ORDERING_INFO[orderings[1]];
    return `Using ${orderingInfo.name.toLowerCase()} with ${secondaryInfo.name.toLowerCase()} as secondary criteria shaped the dispatch sequence.`;
  }

  return `${orderingInfo.name} ordering guided asset selection throughout the event.`;
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

// ---------- Recommendations (Updated for Composable System) ----------

function generateRecommendations(
  score: EnhancedFinalScore,
  config: GameConfig
): string[] {
  const recommendations: string[] = [];
  const strategyConfig = config.strategyConfig;

  // Grade-based recommendations
  if (score.grade.startsWith('D') || score.grade === 'F') {
    recommendations.push('Consider lowering the difficulty level to build familiarity with dispatch mechanics.');
  }

  // Dropoff-based recommendations
  const dropoffRate = score.totalAssetsDropped / (score.totalAssetsPerformed + score.totalAssetsDropped);
  if (dropoffRate > 0.3) {
    recommendations.push('High asset dropoff suggests overly aggressive dispatch. Try a more risk-averse posture or efficiency objective.');
  }

  // Framework-specific recommendations
  recommendations.push(...getFrameworkRecommendations(strategyConfig.decisionFramework, score));

  // Objective-specific recommendations
  recommendations.push(...getObjectiveRecommendations(strategyConfig.objective, score));

  // Risk posture recommendations
  recommendations.push(...getRiskPostureRecommendations(strategyConfig.riskPosture, score, dropoffRate));

  // Selection ordering recommendations
  recommendations.push(...getSelectionRecommendations(strategyConfig.selectionOrderings, score));

  // Asset-specific recommendations (kept from original)
  const hvacPerf = score.assetTypePerformance.find(p => p.assetType === 'hvac_resi');
  if (hvacPerf && hvacPerf.complianceRate < 70) {
    recommendations.push('HVAC assets are struggling with comfort limits. Consider state-based selection to dispatch assets with more headroom.');
  }

  const batteryPerf = score.assetTypePerformance.find(p => p.assetType === 'battery_resi');
  if (batteryPerf && batteryPerf.complianceRate < 70) {
    recommendations.push('Batteries are depleting quickly. Try fairness-based ordering to spread load across the battery fleet.');
  }

  // Limit to top 3 recommendations
  return recommendations.slice(0, 3);
}

function getFrameworkRecommendations(
  framework: DecisionFramework,
  score: EnhancedFinalScore
): string[] {
  const recommendations: string[] = [];

  switch (framework) {
    case 'deterministic_policy':
      if (score.percentTargetMet < 80) {
        recommendations.push('Deterministic policies work best with predictable loads. Try feedback control for more adaptive response.');
      }
      break;

    case 'greedy_myopic':
      if (score.totalAssetsDropped > 5) {
        recommendations.push('Greedy dispatch is exhausting assets. Consider stochastic modeling to preserve capacity for later intervals.');
      }
      break;

    case 'stochastic':
      if (score.percentTargetMet < 85) {
        recommendations.push('Stochastic sampling may benefit from more aggressive sampling. Try opportunity-seeking risk posture.');
      }
      break;

    case 'feedback_control':
      if (Math.abs(score.avgKwVsTarget) > 100) {
        recommendations.push('Feedback control showing high deviation. Try PID-like subtype for smoother error correction.');
      }
      break;
  }

  return recommendations;
}

function getObjectiveRecommendations(
  objective: ObjectiveFunction,
  score: EnhancedFinalScore
): string[] {
  const recommendations: string[] = [];

  switch (objective) {
    case 'capacity':
      if (score.totalAssetsDropped > 5) {
        recommendations.push('Capacity focus is causing asset strain. Balance with risk-minimization or efficiency objective.');
      }
      break;

    case 'risk_minimization':
      if (score.percentTargetMet < 90) {
        recommendations.push('Risk-averse approach may be too conservative. Consider capacity or efficiency objective for better target achievement.');
      }
      break;

    case 'efficiency':
      if (score.percentTargetMet < 85) {
        recommendations.push('Efficiency focus may be under-dispatching. Try capacity objective for harder difficulty levels.');
      }
      break;
  }

  return recommendations;
}

function getRiskPostureRecommendations(
  riskPosture: RiskPosture,
  score: EnhancedFinalScore,
  dropoffRate: number
): string[] {
  const recommendations: string[] = [];

  switch (riskPosture) {
    case 'risk_averse':
      if (score.percentTargetMet < 85) {
        recommendations.push('Risk-averse reserves may be too high. Try neutral posture for better target achievement.');
      }
      break;

    case 'opportunity_seeking':
      if (dropoffRate > 0.2) {
        recommendations.push('Aggressive dispatch is causing dropoffs. Try deadline-aware posture for better pacing.');
      }
      break;

    case 'neutral':
      if (score.grade.startsWith('C') || score.grade.startsWith('D')) {
        recommendations.push('Consider adjusting risk posture: deadline-aware for ramping events, risk-averse for volatile conditions.');
      }
      break;
  }

  return recommendations;
}

function getSelectionRecommendations(
  orderings: SelectionOrdering[],
  score: EnhancedFinalScore
): string[] {
  const recommendations: string[] = [];

  if (orderings.length === 0) return recommendations;

  const primaryCategory = SELECTION_ORDERING_INFO[orderings[0]].category;

  // If using type-based and performance varied widely
  if (primaryCategory === 'asset_type_based') {
    const compliances = score.assetTypePerformance.map(p => p.complianceRate);
    const variance = Math.max(...compliances) - Math.min(...compliances);
    if (variance > 30) {
      recommendations.push('Asset types showed varied performance. Try performance-based ordering to prioritize reliable assets.');
    }
  }

  // If using performance-based but had dropoffs
  if (primaryCategory === 'performance_based' && score.totalAssetsDropped > 3) {
    recommendations.push('Performance-based selection still saw dropoffs. Add fairness-based criteria to spread dispatch load.');
  }

  return recommendations;
}
