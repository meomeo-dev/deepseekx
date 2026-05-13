// Northstar Ops Console — Incident impact scoring.
// Estimates business impact: affected MRR, projected churn risk, blast radius.

export function scoreIncidentImpact(incident, accounts, tickets) {
  // Base impact from severity
  const severityWeights = { sev0: 100, sev1: 65, sev2: 30, sev3: 10 };
  let impact = severityWeights[incident.severity] || 10;

  // Affected account count
  const n = incident.affected_accounts || 0;
  impact += Math.min(60, n * 2);

  // Duration multiplier
  if (incident.duration_m != null) {
    const hours = incident.duration_m / 60;
    impact += Math.min(40, hours * 3);
  }

  // If still open and aging
  if (incident.status !== "closed" && incident.status !== "resolved") {
    const ageH = (Date.now() - incident.opened_at) / 3600000;
    if (ageH > 8) impact += 20;
    else if (ageH > 2) impact += 8;
  }

  // Estimated affected MRR (if we can map to accounts — simplified)
  const affectedMRR = Math.round(n * 3500); // average MRR estimate
  impact += Math.min(50, affectedMRR / 1000);

  const total = Math.min(200, Math.round(impact));

  return {
    score: total,
    level: total >= 120 ? "critical" : total >= 60 ? "high" : total >= 25 ? "medium" : "low",
    estimated_affected_mrr: affectedMRR,
    projected_churn_risk_pct: total >= 120 ? 8 : total >= 60 ? 3 : total >= 25 ? 1 : 0.2,
    factors: {
      severity_weight: severityWeights[incident.severity],
      account_count: n,
      duration_penalty: incident.duration_m != null ? Math.min(40, (incident.duration_m / 60) * 3) : 0,
    },
  };
}

export function summarizeIncidentImpacts(incidents) {
  return incidents
    .map(inc => ({ incident: inc, impact: scoreIncidentImpact(inc, [], []) }))
    .sort((a, b) => b.impact.score - a.impact.score);
}
