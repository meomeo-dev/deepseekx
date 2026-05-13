// Northstar Ops Console — Account health and churn-risk scoring.
// Returns scores 0–100 where higher = healthier.

const DAY_MS = 86400000;
const NOW_TS = Date.now();

export function computeHealthScore(account, tickets, usageEvents) {
  let score = 100;
  const deductions = [];

  // Usage decline (>15% drop over last 30 days vs prior 30 days)
  const recentUsage = avgUsage(usageEvents, NOW_TS - 30 * DAY_MS, NOW_TS);
  const priorUsage = avgUsage(usageEvents, NOW_TS - 60 * DAY_MS, NOW_TS - 30 * DAY_MS);
  if (priorUsage > 0 && recentUsage / priorUsage < 0.85) {
    const drop = (1 - recentUsage / priorUsage);
    score -= Math.round(drop * 40);
    deductions.push(`Usage down ${(drop * 100).toFixed(0)}% (${recentUsage.toFixed(0)} vs ${priorUsage.toFixed(0)})`);
  }

  // Open critical/high tickets
  const openCritical = tickets.filter(t => t.status !== "resolved" && (t.priority === "critical" || t.priority === "high"));
  if (openCritical.length > 2) { score -= 25; deductions.push(`${openCritical.length} critical/high tickets open`); }
  else if (openCritical.length > 0) { score -= openCritical.length * 8; deductions.push(`${openCritical.length} critical/high tickets open`); }

  // No usage in 14 days
  if (recentUsage < 5 && priorUsage > 10) { score -= 30; deductions.push("Usage near zero in last 14 days"); }

  // MRR magnitude (larger accounts get flagged more severely)
  if (account.mrr > 10000 && score < 75) { score -= 5; deductions.push("High-MRR account at risk"); }

  // Satisfaction — find average NPS-like score from tickets
  const resolvedTix = tickets.filter(t => t.resolved_at && t.satisfaction_score != null);
  if (resolvedTix.length >= 3) {
    const avgSat = resolvedTix.reduce((s, t) => s + t.satisfaction_score, 0) / resolvedTix.length;
    if (avgSat < 2.5) { score -= 20; deductions.push(`Low CSAT: ${avgSat.toFixed(1)}/5`); }
    else if (avgSat < 3.5) { score -= 8; deductions.push(`CSAT declining: ${avgSat.toFixed(1)}/5`); }
  }

  // Feature adoption depth
  if (account.feature_adoption != null) {
    if (account.feature_adoption < 0.2) { score -= 12; deductions.push("Low feature adoption"); }
    else if (account.feature_adoption > 0.7) { score += 5; }
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    risk_level: score >= 80 ? "low" : score >= 50 ? "medium" : "high",
    deductions,
    usage_trend: recentUsage >= priorUsage ? "stable_or_growing" : "declining",
  };
}

function avgUsage(events, from, to) {
  const inRange = events.filter(e => e.timestamp >= from && e.timestamp <= to);
  if (!inRange.length) return 0;
  return inRange.reduce((s, e) => s + e.value, 0) / inRange.length;
}

export function computeEngagementScore(account, usageEvents, tickets, npsResponses) {
  let score = 50;

  // Usage frequency (daily active %)
  const last30 = usageEvents.filter(e => e.timestamp > NOW_TS - 30 * DAY_MS);
  const uniqueDays = new Set(last30.map(e => new Date(e.timestamp).toDateString()));
  const activeDays = uniqueDays.size;
  score += Math.min(30, activeDays * 1.2);

  // Ticket volume (some is fine, too many is bad)
  const recentTickets = tickets.filter(t => t.created_at > NOW_TS - 30 * DAY_MS);
  if (recentTickets.length <= 2) score += 10;
  else if (recentTickets.length <= 5) score += 5;
  else if (recentTickets.length > 8) score -= 10;

  // NPS
  const recentNps = npsResponses.filter(n => n.timestamp > NOW_TS - 90 * DAY_MS);
  if (recentNps.length > 0) {
    const avgNps = recentNps.reduce((s, n) => s + n.score, 0) / recentNps.length;
    score += Math.round(avgNps * 2);
  }

  // Feature adoption bonus
  if (account.feature_adoption != null) {
    score += Math.round(account.feature_adoption * 15);
  }

  return { score: Math.max(0, Math.min(100, score)), active_days: activeDays };
}

export function churnRiskCategory(healthScore) {
  if (healthScore.score >= 80) return { label: "Healthy", color: "var(--green)", action: "Monitor" };
  if (healthScore.score >= 50) return { label: "At Risk", color: "var(--amber)", action: "Engage CSM" };
  return { label: "Critical", color: "var(--red)", action: "Urgent intervention" };
}
