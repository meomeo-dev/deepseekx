// Northstar Ops Console — Renewal probability and revenue forecasting.
// Uses a weighted-factor model: health score, engagement, contract age, MRR tier.

const DAY_MS = 86400000;
const NOW_TS = Date.now();

const MRR_TIER_BASE = [
  { max: 2000,  base: 0.92 },
  { max: 5000,  base: 0.88 },
  { max: 10000, base: 0.85 },
  { max: Infinity, base: 0.82 },
];

export function forecastRenewal(account, healthScore, engagementScore, contract) {
  if (!contract) return { probability: null, expected_value: null, factors: [] };

  // Base from MRR tier
  let prob = 0.90;
  for (const tier of MRR_TIER_BASE) {
    if (account.mrr <= tier.max) { prob = tier.base; break; }
  }

  const factors = [];

  // Health score adjustment
  if (healthScore.score >= 80) { prob += 0.04; factors.push({ name: "Health score high", effect: +0.04 }); }
  else if (healthScore.score < 50) { prob -= 0.12; factors.push({ name: "Health score critical", effect: -0.12 }); }
  else if (healthScore.score < 70) { prob -= 0.05; factors.push({ name: "Health score declining", effect: -0.05 }); }

  // Engagement
  if (engagementScore.score >= 70) { prob += 0.03; factors.push({ name: "High engagement", effect: +0.03 }); }
  else if (engagementScore.score < 30) { prob -= 0.08; factors.push({ name: "Low engagement", effect: -0.08 }); }

  // Days until renewal (urgency)
  const daysLeft = Math.max(0, (contract.renewal_date - NOW_TS) / DAY_MS);
  if (daysLeft < 30) { prob -= 0.02; factors.push({ name: "Renewal imminent (<30d)", effect: -0.02 }); }

  // Contract age (tenure bonus)
  const contractAgeDays = (NOW_TS - contract.start_date) / DAY_MS;
  if (contractAgeDays > 365) { prob += 0.03; factors.push({ name: "Long-tenure account", effect: +0.03 }); }

  // Success plan completion
  if (contract.success_plan_pct != null) {
    if (contract.success_plan_pct >= 0.8) { prob += 0.04; factors.push({ name: "Success plan on track", effect: +0.04 }); }
    else if (contract.success_plan_pct < 0.3) { prob -= 0.06; factors.push({ name: "Success plan behind", effect: -0.06 }); }
  }

  prob = Math.max(0.05, Math.min(0.99, prob));

  return {
    probability: parseFloat(prob.toFixed(4)),
    expected_value: parseFloat((prob * account.mrr * 12).toFixed(0)),
    factors,
    days_until_renewal: Math.round(daysLeft),
  };
}

export function aggregateRenewalForecast(accounts, healthScores, engagementScores, contracts) {
  const forecasts = [];
  let totalExpected = 0;
  let totalMRR = 0;
  const byRisk = { high: [], medium: [], low: [] };

  for (const acct of accounts) {
    if (acct.health === "churned") continue;
    const contract = contracts[acct.id];
    const hs = healthScores[acct.id] || { score: 50 };
    const es = engagementScores[acct.id] || { score: 50 };
    const f = forecastRenewal(acct, hs, es, contract);

    totalMRR += acct.mrr * 12;
    if (f.probability != null) {
      totalExpected += f.expected_value;
      const risk = f.probability >= 0.85 ? "low" : f.probability >= 0.60 ? "medium" : "high";
      byRisk[risk].push({ ...acct, forecast: f });
      forecasts.push({ account: acct, forecast: f, risk });
    }
  }

  return {
    forecasts,
    total_expected_arr: totalExpected,
    total_current_arr: totalMRR,
    renewal_rate_forecast: totalMRR > 0 ? parseFloat((totalExpected / totalMRR).toFixed(4)) : 0,
    at_risk_revenue: byRisk.high.reduce((s, a) => s + a.mrr * 12, 0),
    byRisk,
  };
}
