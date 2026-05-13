// Blast-radius estimation — determines which accounts and services are affected
// by an incident, and estimates business impact.

export function estimateBlastRadius(incident, accounts, accountTickets, incidentImpactMap) {
  // incidentImpactMap: maps incident.id -> list of affected account IDs
  const impactedIds = (incidentImpactMap && incidentImpactMap[incident.id]) || [];

  // Find impacted accounts
  const impactedAccounts = accounts.filter(a => impactedIds.includes(a.id));

  // If no explicit mapping, use affected_accounts count to estimate
  const estimatedCount = impactedAccounts.length || incident.affected_accounts || 0;

  // Categorize by health and MRR
  const byHealth = { healthy: [], at_risk: [], churned: [] };
  for (const a of impactedAccounts) {
    byHealth[a.health] = byHealth[a.health] || [];
    byHealth[a.health].push(a);
  }

  const totalMRR = impactedAccounts.reduce((s, a) => s + a.mrr, 0);
  const atRiskMRR = (byHealth.at_risk || []).reduce((s, a) => s + a.mrr, 0);

  // Find related open tickets for impacted accounts
  const relatedTickets = accountTickets.filter(t =>
    impactedIds.includes(t.account_id) && t.status !== "resolved"
  );

  // Blast score: severity × affected × mrr factor
  const severityWeight = { sev0: 10, sev1: 6, sev2: 3, sev3: 1 };
  const baseScore = (severityWeight[incident.severity] || 3);
  const accountFactor = Math.min(5, estimatedCount / 5);
  const mrrFactor = Math.min(5, totalMRR / 20000);
  const ticketFactor = Math.min(3, relatedTickets.length);

  const blastScore = Math.round((baseScore + accountFactor + mrrFactor + ticketFactor) * 5);
  const normalized = Math.min(100, blastScore);

  return {
    blast_score: normalized,
    blast_level: normalized >= 70 ? "severe" : normalized >= 40 ? "significant" : normalized >= 15 ? "moderate" : "low",
    impacted_account_count: estimatedCount,
    impacted_mrr: totalMRR,
    at_risk_mrr: atRiskMRR,
    by_health: {
      healthy: (byHealth.healthy || []).length,
      at_risk: (byHealth.at_risk || []).length,
      churned: (byHealth.churned || []).length,
    },
    related_open_tickets: relatedTickets.length,
    top_impacted: impactedAccounts
      .sort((a, b) => b.mrr - a.mrr)
      .slice(0, 5)
      .map(a => ({ id: a.id, name: a.name, mrr: a.mrr, health: a.health })),
    factors: {
      severity_base: baseScore,
      account_count: parseFloat(accountFactor.toFixed(1)),
      mrr_exposure: parseFloat(mrrFactor.toFixed(1)),
      ticket_cascade: ticketFactor,
    },
  };
}

export function blastRadiusSummary(incidents, blastMap) {
  const results = [];
  for (const inc of incidents) {
    const blast = blastMap[inc.id];
    if (blast) results.push({ incident: inc, blast });
  }
  results.sort((a, b) => b.blast.blast_score - a.blast.blast_score);

  return {
    total_incidents_analyzed: results.length,
    severe_blasts: results.filter(r => r.blast.blast_level === "severe").length,
    total_impacted_accounts: results.reduce((s, r) => s + r.blast.impacted_account_count, 0),
    total_impacted_mrr: results.reduce((s, r) => s + r.blast.impacted_mrr, 0),
    results,
  };
}
