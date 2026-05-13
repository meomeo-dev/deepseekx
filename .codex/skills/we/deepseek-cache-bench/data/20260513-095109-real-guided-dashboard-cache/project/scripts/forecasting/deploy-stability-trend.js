// Deployment stability trend — projects deploy risk and success rate over time.

const DAY = 86400000;

export function projectDeployStability(deployments, deployChecks, assumptions) {
  const now = Date.now();
  const monthly = {};
  for (const d of deployments) {
    const key = new Date(d.started_at).toISOString().slice(0, 7);
    if (!monthly[key]) monthly[key] = { deploys: 0, completed: 0, rolled_back: 0, total_risk: 0, risk_scores: [] };
    monthly[key].deploys++;
    if (d.status === "completed") monthly[key].completed++;
    if (d.status === "rolled_back") monthly[key].rolled_back++;
    monthly[key].total_risk += d.risk_score || 5;
    monthly[key].risk_scores.push(d.risk_score || 5);
  }

  const months = Object.entries(monthly).sort((a, b) => a[0].localeCompare(b[0]));
  const recent = months.slice(-6);

  const avgDeploys = recent.reduce((s, [, v]) => s + v.deploys, 0) / (recent.length || 1);
  const avgSuccessRate = recent.reduce((s, [, v]) => s + (v.deploys > 0 ? v.completed / v.deploys : 1), 0) / (recent.length || 1);
  const avgRisk = recent.reduce((s, [, v]) => s + (v.risk_scores.length ? v.total_risk / v.risk_scores.length : 5), 0) / (recent.length || 1);

  const deployGrowth = assumptions?.deploy_growth_rate || 0.02;
  const riskTrend = recent.length >= 3
    ? recent[recent.length - 1].risk_scores.reduce((s, r) => s + r, 0) / recent[recent.length - 1].risk_scores.length
      - recent[recent.length - 3].risk_scores.reduce((s, r) => s + r, 0) / recent[recent.length - 3].risk_scores.length
    : 0;

  const forecast = [];
  let projDeploys = avgDeploys;
  let projRisk = avgRisk;

  for (let m = 0; m < 12; m++) {
    projDeploys = Math.round(projDeploys * (1 + deployGrowth));
    projRisk = Math.max(1, Math.min(10, projRisk + riskTrend * 0.3));

    const projSuccess = avgSuccessRate - (projRisk > 7 ? 0.05 : 0);
    const projCompleted = Math.round(projDeploys * projSuccess);
    const projRollbacks = projDeploys - projCompleted;

    forecast.push({
      month: m + 1,
      date: new Date(now + m * 30 * DAY).toISOString().slice(0, 7),
      projected_deploys: projDeploys,
      projected_success_rate: parseFloat(projSuccess.toFixed(2)),
      projected_rollbacks: projRollbacks,
      avg_risk_score: parseFloat(projRisk.toFixed(1)),
      stability: projRisk < 5 ? "improving" : projRisk < 7 ? "stable" : "degrading",
    });
  }

  return {
    monthly: forecast,
    current_avg_risk: parseFloat(avgRisk.toFixed(1)),
    current_success_rate: parseFloat((avgSuccessRate * 100).toFixed(1)),
    projected_rollbacks_12m: forecast.reduce((s, f) => s + f.projected_rollbacks, 0),
    risk_trend_direction: riskTrend > 0.1 ? "worsening" : riskTrend < -0.1 ? "improving" : "stable",
    historical: months.slice(-12).map(([month, v]) => ({
      month,
      deploys: v.deploys,
      success_rate: v.deploys > 0 ? parseFloat((v.completed / v.deploys * 100).toFixed(1)) : 100,
      avg_risk: v.risk_scores.length ? parseFloat((v.total_risk / v.risk_scores.length).toFixed(1)) : 0,
      rollbacks: v.rolled_back,
    })),
  };
}
