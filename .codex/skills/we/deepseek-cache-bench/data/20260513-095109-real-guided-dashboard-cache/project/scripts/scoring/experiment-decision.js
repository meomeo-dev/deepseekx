// Northstar Ops Console — Experiment decisioning engine.
// Uses Bayesian-style analysis with significance and practical significance checks.

export function decideExperiment(experiment, dailySamples) {
  const { variant_a_users, variant_b_users, lift_pct, confidence, metric } = experiment;

  // Statistical significance check
  const isSignificant = confidence >= 0.90;
  const isHighlySignificant = confidence >= 0.95;

  // Practical significance: is the lift meaningful?
  const absLift = Math.abs(lift_pct);
  const isPracticallySignificant = absLift >= 2;

  // Sample size adequacy
  const totalUsers = variant_a_users + variant_b_users;
  const hasAdequateSample = totalUsers >= 500;

  // Trend check from daily samples
  let trendStable = true;
  let trendDirection = "flat";
  if (dailySamples && dailySamples.length >= 5) {
    const recent = dailySamples.slice(-5);
    const lifts = recent.map(s => s.lift_pct);
    const increasing = lifts.every((l, i) => i === 0 || l >= lifts[i - 1]);
    const decreasing = lifts.every((l, i) => i === 0 || l <= lifts[i - 1]);
    if (increasing && lift_pct > 0) trendDirection = "improving";
    else if (decreasing && lift_pct < 0) trendDirection = "worsening";
    else if (lifts.length >= 3) {
      const variance = lifts.reduce((s, l) => s + (l - lift_pct) ** 2, 0) / lifts.length;
      trendStable = Math.sqrt(variance) < 1.5;
    }
  }

  // Decision logic
  let decision, reason;
  if (!isSignificant) {
    decision = "continue";
    reason = "Not statistically significant yet. Continue gathering data.";
  } else if (!isPracticallySignificant) {
    decision = "inconclusive";
    reason = "Statistically significant but lift too small to matter. Consider deprecating.";
  } else if (!hasAdequateSample && !isHighlySignificant) {
    decision = "continue";
    reason = "Significant but sample small. Continue to validate.";
  } else if (!trendStable && isSignificant) {
    decision = "continue";
    reason = "Trend not yet stable. Monitor for convergence.";
  } else if (isHighlySignificant && isPracticallySignificant && lift_pct > 0 && trendStable) {
    decision = "ship";
    reason = `Highly significant positive lift of ${lift_pct.toFixed(1)}% with stable trend. Ship variant B.`;
  } else if (isHighlySignificant && isPracticallySignificant && lift_pct < 0 && trendStable) {
    decision = "discard";
    reason = `Significant negative lift. Keep variant A. Discard variant B.`;
  } else if (isSignificant && isPracticallySignificant && lift_pct > 0) {
    decision = "ship";
    reason = `Significant positive lift. Recommend shipping.`;
  } else {
    decision = "review";
    reason = "Mixed signals. Manual review recommended.";
  }

  return {
    decision,
    reason,
    is_significant: isSignificant,
    is_highly_significant: isHighlySignificant,
    is_practically_significant: isPracticallySignificant,
    has_adequate_sample: hasAdequateSample,
    trend_stable: trendStable,
    trend_direction: trendDirection,
    recommendation: {
      ship: decision === "ship",
      discard: decision === "discard",
      continue: decision === "continue",
      review: decision === "review" || decision === "inconclusive",
    },
    summary: `${metric.replace(/_/g, " ")}: ${decision === "ship" ? "✓ Ship" : decision === "discard" ? "✗ Discard" : "⟳ " + decision}`,
  };
}

export function batchDecide(experiments, samplesMap) {
  return experiments.map(exp => ({
    experiment: exp,
    decision: decideExperiment(exp, samplesMap[exp.id] || []),
  }));
}
