// Product-qualified account (PQA) detection — identifies accounts ready for
// expansion based on product usage signals.

const DAY = 86400000;
const NOW = Date.now();

export function detectPQA(account, usageEvents, featureAdoption, expansionSignals) {
  const events = (usageEvents || []).filter(e => e.account_id === account.id);
  const recent = events.filter(e => e.timestamp > NOW - 30 * DAY);
  const activeDays = new Set(recent.map(e => new Date(e.timestamp).toDateString())).size;
  const ad = featureAdoption[account.id] || {};
  const signals = (expansionSignals || []).filter(s => s.account_id === account.id);
  const recentSignals = signals.filter(s => s.timestamp > NOW - 60 * DAY);

  let score = 0;
  const factors = [];

  // Usage frequency
  if (activeDays >= 20) { score += 30; factors.push("High-frequency usage (20+ days/mo)"); }
  else if (activeDays >= 12) { score += 15; factors.push("Moderate usage (12+ days/mo)"); }

  // Feature depth
  const adoptedCount = (ad.adopted_features || []).length;
  if (adoptedCount >= 6) { score += 25; factors.push(`${adoptedCount} features adopted`); }
  else if (adoptedCount >= 3) { score += 10; factors.push(`${adoptedCount} features adopted`); }

  // Usage near plan limits (ready for upgrade)
  if (account.usage_pct > 80) { score += 20; factors.push(`Near capacity (${account.usage_pct}% usage)`); }

  // Expansion signals
  const signalScore = Math.min(15, recentSignals.length * 5);
  score += signalScore;
  if (signalScore > 0) factors.push(`${recentSignals.length} expansion signals`);

  // Tenure bonus
  const daysSinceCreated = (NOW - account.created_at) / DAY;
  if (daysSinceCreated > 180) { score += 10; factors.push("Established account (6+ months)"); }
  else if (daysSinceCreated > 90) { score += 5; factors.push("Maturing account (3+ months)"); }

  // Health disqualifier
  if (account.health === "at_risk") { score -= 20; factors.push("At-risk account — hold expansion"); }

  score = Math.max(0, Math.min(100, score));

  return {
    account_id: account.id,
    account_name: account.name,
    plan: account.plan,
    mrr: account.mrr,
    pqa_score: score,
    pqa_level: score >= 70 ? "qualified" : score >= 45 ? "approaching" : "not_ready",
    active_days: activeDays,
    factors,
    recommendation: score >= 70
      ? "Initiate expansion conversation — strong product signals"
      : score >= 45
        ? "Nurture with targeted feature adoption campaigns"
        : "Continue standard adoption path",
  };
}

export function batchDetectPQA(accounts, usageEvents, featureAdoption, expansionSignals) {
  return accounts
    .filter(a => a.health !== "churned")
    .map(a => detectPQA(a, usageEvents, featureAdoption, expansionSignals))
    .sort((a, b) => b.pqa_score - a.pqa_score);
}

export function pqaSummary(detected) {
  const byLevel = {};
  let qualifiedMRR = 0;
  for (const d of detected) {
    byLevel[d.pqa_level] = (byLevel[d.pqa_level] || 0) + 1;
    if (d.pqa_level === "qualified") qualifiedMRR += d.mrr;
  }
  return {
    total: detected.length,
    qualified: byLevel.qualified || 0,
    approaching: byLevel.approaching || 0,
    qualified_mrr: qualifiedMRR,
    top_qualified: detected.filter(d => d.pqa_level === "qualified").slice(0, 10),
  };
}
