// Incident risk forecast — projects future incident volume and severity.

const DAY = 86400000;

export function projectIncidentRisk(incidents, deployments, assumptions) {
  const now = Date.now();
  const monthlyIncidents = {};
  for (const inc of incidents) {
    const d = new Date(inc.opened_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthlyIncidents[key]) monthlyIncidents[key] = { total: 0, sev0: 0, sev1: 0, sev2: 0, sev3: 0 };
    monthlyIncidents[key].total++;
    monthlyIncidents[key][inc.severity] = (monthlyIncidents[key][inc.severity] || 0) + 1;
  }

  const months = Object.entries(monthlyIncidents).sort((a, b) => a[0].localeCompare(b[0]));
  const recent = months.slice(-6);
  const avgIncidents = recent.reduce((s, [, v]) => s + v.total, 0) / (recent.length || 1);

  // Deploy velocity correlates with incidents
  const recentDeploys = deployments.filter(d => d.started_at > now - 90 * DAY).length;
  const deployRate = recentDeploys / 3; // per month
  const incidentPerDeploy = avgIncidents / (deployRate || 1);

  const deployGrowth = assumptions?.deploy_growth_rate || 0.02;

  const forecast = [];
  let projDeploys = deployRate;

  for (let m = 0; m < 12; m++) {
    projDeploys = projDeploys * (1 + deployGrowth);
    const projIncidents = Math.round(projDeploys * incidentPerDeploy);
    const sev0Prob = assumptions?.sev0_probability || 0.03;
    const sev1Prob = assumptions?.sev1_probability || 0.12;

    forecast.push({
      month: m + 1,
      date: new Date(now + m * 30 * DAY).toISOString().slice(0, 7),
      projected_incidents: projIncidents,
      projected_deploys: parseFloat(projDeploys.toFixed(1)),
      estimated_sev0: Math.round(projIncidents * sev0Prob),
      estimated_sev1: Math.round(projIncidents * sev1Prob),
      estimated_sev2_3: Math.round(projIncidents * (1 - sev0Prob - sev1Prob)),
      risk_level: projIncidents > avgIncidents * 1.5 ? "elevated" : projIncidents > avgIncidents * 1.2 ? "moderate" : "stable",
    });
  }

  return {
    monthly: forecast,
    avg_monthly_incidents: Math.round(avgIncidents),
    peak_incidents: Math.max(...forecast.map(f => f.projected_incidents)),
    total_12m_sev0_estimated: forecast.reduce((s, f) => s + f.estimated_sev0, 0),
    total_12m_sev1_estimated: forecast.reduce((s, f) => s + f.estimated_sev1, 0),
    risk_trend: forecast[forecast.length - 1].risk_level,
  };
}
