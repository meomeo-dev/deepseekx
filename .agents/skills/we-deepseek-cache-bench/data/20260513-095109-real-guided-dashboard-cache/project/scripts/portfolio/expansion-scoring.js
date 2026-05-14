// Expansion opportunity scoring — identifies upsell/cross-sell potential.
// Weights: plan headroom, usage saturation, feature gap, engagement, growth signals.

export function scoreExpansionOpportunity(account, fixtures) {
  let score = 0;
  const factors = [];
  const adoption = (fixtures.featureAdoption || {})[account.id] || {};
  const usageEvents = (fixtures.usageEvents || []).filter(e => e.account_id === account.id);
  const expansionSignals = (fixtures.expansionSignals || []).filter(s => s.account_id === account.id);
  const contract = (fixtures.contracts || {})[account.id];

  // Plan headroom — accounts on lower plans have more room to grow
  const planTiers = { Starter: 20, Growth: 15, Business: 8, Enterprise: 3 };
  const tierScore = planTiers[account.plan] || 10;
  score += tierScore;
  factors.push({ name: "Plan upgrade headroom", score: tierScore });

  // Usage saturation — high usage = ready for more
  const recentUsage = usageEvents.filter(e => e.timestamp > Date.now() - 30 * 86400000);
  const avgUsage = recentUsage.length ? recentUsage.reduce((s, e) => s + e.value, 0) / recentUsage.length : 0;
  if (avgUsage > 80) { score += 20; factors.push({ name: "Near capacity usage", score: 20 }); }
  else if (avgUsage > 60) { score += 10; factors.push({ name: "Growing usage", score: 10 }); }
  else if (avgUsage < 20) { score -= 5; factors.push({ name: "Low usage — not ready", score: -5 }); }

  // Feature adoption gap — unused features = expansion potential
  if (adoption.rate != null) {
    const gap = 1 - adoption.rate;
    const gapScore = Math.round(gap * 12);
    score += gapScore;
    factors.push({ name: `Feature gap (${adoption.unused_features?.length || 0} unused)`, score: gapScore });
  }

  // Seat utilization
  if (account.seats > 0 && account.usage_pct != null) {
    const seatUtil = account.usage_pct / 100;
    if (seatUtil > 0.85) { score += 12; factors.push({ name: "High seat utilization", score: 12 }); }
    else if (seatUtil > 0.6) { score += 5; factors.push({ name: "Moderate seat utilization", score: 5 }); }
  }

  // Expansion signals (explicit buying signals)
  const recentSignals = expansionSignals.filter(s => s.timestamp > Date.now() - 90 * 86400000);
  const signalScore = Math.min(15, recentSignals.length * 5);
  score += signalScore;
  if (signalScore > 0) factors.push({ name: `${recentSignals.length} expansion signals`, score: signalScore });

  // Contract age — mature accounts are better expansion targets
  if (contract) {
    const ageDays = (Date.now() - contract.start_date) / 86400000;
    if (ageDays > 180) { score += 8; factors.push({ name: "Mature account (>6mo)", score: 8 }); }
    else if (ageDays > 90) { score += 3; factors.push({ name: "Established account", score: 3 }); }
  }

  // Engagement bonus
  if (account.health === "healthy") { score += 5; factors.push({ name: "Healthy account", score: 5 }); }
  else if (account.health === "at_risk") { score -= 10; factors.push({ name: "At-risk — defer expansion", score: -10 }); }

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    level: score >= 65 ? "strong" : score >= 40 ? "moderate" : score >= 20 ? "low" : "none",
    factors,
    recommendation: score >= 65
      ? "Proactive expansion conversation recommended"
      : score >= 40
        ? "Monitor for expansion triggers"
        : "Not ready for expansion",
  };
}

export function topExpansionOpportunities(accounts, fixtures, limit = 10) {
  return accounts
    .filter(a => a.health !== "churned")
    .map(a => ({ account: a, opportunity: scoreExpansionOpportunity(a, fixtures) }))
    .sort((a, b) => b.opportunity.score - a.opportunity.score)
    .slice(0, limit);
}

export function expansionSummary(scored) {
  const byLevel = { strong: 0, moderate: 0, low: 0, none: 0 };
  let totalScore = 0;
  for (const s of scored) {
    byLevel[s.opportunity.level] = (byLevel[s.opportunity.level] || 0) + 1;
    totalScore += s.opportunity.score;
  }
  return {
    byLevel,
    avgScore: scored.length ? Math.round(totalScore / scored.length) : 0,
    strongCount: byLevel.strong,
    totalExpansionARR: scored
      .filter(s => s.opportunity.level === "strong")
      .reduce((sum, s) => sum + s.account.mrr * 3, 0), // estimated expansion ARR
  };
}
