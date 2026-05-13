// Churn cohort forecast — projects future churn from cohort behavior.

const DAY = 86400000;

export function projectChurn(accounts, retentionCohorts, revenueEvents, assumptions) {
  const now = Date.now();
  const monthlyChurnRate = assumptions?.base_churn_rate || 0.025;

  // Segment accounts by health for risk-adjusted churn
  const healthy = accounts.filter(a => a.health === "healthy" && a.health !== "churned");
  const atRisk = accounts.filter(a => a.health === "at_risk");

  const healthyMRR = healthy.reduce((s, a) => s + a.mrr, 0);
  const atRiskMRR = atRisk.reduce((s, a) => s + a.mrr, 0);

  // Risk-adjusted churn rates
  const healthyChurnRate = monthlyChurnRate * 0.3;
  const atRiskChurnRate = monthlyChurnRate * 3.0;

  const forecast = [];
  let remainingHealthyMRR = healthyMRR;
  let remainingAtRiskMRR = atRiskMRR;
  let cumulativeChurnMRR = 0;

  for (let m = 0; m < 12; m++) {
    const healthyChurn = remainingHealthyMRR * healthyChurnRate;
    const atRiskChurn = remainingAtRiskMRR * atRiskChurnRate;
    const totalChurn = healthyChurn + atRiskChurn;

    remainingHealthyMRR -= healthyChurn;
    remainingAtRiskMRR -= atRiskChurn;
    cumulativeChurnMRR += totalChurn;

    // Some at-risk accounts recover to healthy
    const recoveries = remainingAtRiskMRR * 0.08;
    remainingAtRiskMRR -= recoveries;
    remainingHealthyMRR += recoveries;

    forecast.push({
      month: m + 1,
      date: new Date(now + m * 30 * DAY).toISOString().slice(0, 7),
      healthy_churn: Math.round(healthyChurn),
      at_risk_churn: Math.round(atRiskChurn),
      total_churn: Math.round(totalChurn),
      recoveries: Math.round(recoveries),
      remaining_healthy_mrr: Math.round(remainingHealthyMRR),
      remaining_at_risk_mrr: Math.round(remainingAtRiskMRR),
      cumulative_churn_arr: Math.round(cumulativeChurnMRR * 12),
    });
  }

  return {
    monthly: forecast,
    total_12m_churn_arr: Math.round(cumulativeChurnMRR * 12),
    total_12m_churn_accounts_estimated: Math.round(cumulativeChurnMRR / 3000),
    peak_churn_month: forecast.reduce((best, f) => f.total_churn > best.total_churn ? f : best, forecast[0]).month,
  };
}

export function churnRiskBySegment(accounts) {
  const segments = {};
  for (const a of accounts) {
    const seg = a.plan || "unknown";
    if (!segments[seg]) segments[seg] = { plan: seg, healthy: 0, at_risk: 0, churned: 0, total_mrr: 0, at_risk_mrr: 0 };
    segments[seg][a.health] = (segments[seg][a.health] || 0) + 1;
    if (a.health === "at_risk") segments[seg].at_risk_mrr += a.mrr;
    if (a.health !== "churned") segments[seg].total_mrr += a.mrr;
  }
  return Object.values(segments).map(s => ({
    ...s,
    at_risk_pct: s.healthy + s.at_risk > 0 ? parseFloat((s.at_risk / (s.healthy + s.at_risk) * 100).toFixed(1)) : 0,
    risk_weighted_arr: Math.round(s.at_risk_mrr * 0.3),
  }));
}
