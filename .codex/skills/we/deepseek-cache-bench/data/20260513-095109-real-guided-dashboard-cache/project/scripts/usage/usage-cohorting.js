// Usage cohorting — groups accounts by usage patterns and trends.

const DAY = 86400000;
const NOW = Date.now();

export function cohortByUsageLevel(accounts, usageEvents) {
  const cohorts = {
    heavy: [],
    moderate: [],
    light: [],
    dormant: [],
  };

  for (const a of accounts) {
    if (a.health === "churned") continue;
    const events = (usageEvents || []).filter(e => e.account_id === a.id);
    const recentEvents = events.filter(e => e.timestamp > NOW - 30 * DAY);
    const activeDays = new Set(recentEvents.map(e =>
      new Date(e.timestamp).toDateString()
    )).size;

    if (activeDays >= 20) cohorts.heavy.push(a);
    else if (activeDays >= 10) cohorts.moderate.push(a);
    else if (activeDays >= 2) cohorts.light.push(a);
    else cohorts.dormant.push(a);
  }

  return {
    cohorts,
    heavy: { count: cohorts.heavy.length, mrr: sumMRR(cohorts.heavy) },
    moderate: { count: cohorts.moderate.length, mrr: sumMRR(cohorts.moderate) },
    light: { count: cohorts.light.length, mrr: sumMRR(cohorts.light) },
    dormant: { count: cohorts.dormant.length, mrr: sumMRR(cohorts.dormant) },
  };
}

export function detectUsageTrend(account, usageEvents) {
  const events = (usageEvents || []).filter(e => e.account_id === account.id);
  if (events.length < 14) return { trend: "insufficient_data", change_pct: 0 };

  const recent = events.filter(e => e.timestamp > NOW - 30 * DAY);
  const prior = events.filter(e => e.timestamp <= NOW - 30 * DAY && e.timestamp > NOW - 60 * DAY);

  const recentAvg = recent.length ? recent.reduce((s, e) => s + e.value, 0) / recent.length : 0;
  const priorAvg = prior.length ? prior.reduce((s, e) => s + e.value, 0) / prior.length : 0;

  if (priorAvg === 0) return { trend: "new_account", change_pct: 0 };

  const changePct = ((recentAvg - priorAvg) / priorAvg) * 100;

  let trend;
  if (changePct > 15) trend = "growing";
  else if (changePct < -15) trend = "declining";
  else trend = "stable";

  return {
    account_id: account.id,
    account_name: account.name,
    trend,
    change_pct: parseFloat(changePct.toFixed(1)),
    recent_avg: parseFloat(recentAvg.toFixed(1)),
    prior_avg: parseFloat(priorAvg.toFixed(1)),
    recent_active_days: new Set(recent.map(e => new Date(e.timestamp).toDateString())).size,
  };
}

export function batchDetectTrends(accounts, usageEvents) {
  return accounts
    .filter(a => a.health !== "churned")
    .map(a => detectUsageTrend(a, usageEvents));
}

export function trendSummary(trends) {
  const byTrend = {};
  for (const t of trends) {
    byTrend[t.trend] = (byTrend[t.trend] || 0) + 1;
  }
  return {
    total: trends.length,
    growing: byTrend.growing || 0,
    stable: byTrend.stable || 0,
    declining: byTrend.declining || 0,
    dormant: byTrend.insufficient_data || 0,
    declining_accounts: trends.filter(t => t.trend === "declining"),
  };
}

function sumMRR(accounts) {
  return accounts.reduce((s, a) => s + (a.mrr || 0), 0);
}
