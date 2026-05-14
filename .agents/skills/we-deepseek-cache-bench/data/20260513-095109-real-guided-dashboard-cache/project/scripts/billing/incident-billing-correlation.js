// Billing-incident correlation — links incidents to billing impacts (credits, refunds, disputes).

export function correlateIncidentsToBilling(incidents, creditMemos, paymentFailures, incidentImpactMap) {
  const correlations = [];

  for (const inc of incidents) {
    const impactedAccountIds = (incidentImpactMap && incidentImpactMap[inc.id]) || [];

    // Find credit memos linked to this incident's timeframe
    const relatedCredits = creditMemos.filter(cm =>
      impactedAccountIds.includes(cm.account_id) &&
      cm.created_at >= inc.opened_at &&
      (inc.closed_at ? cm.created_at <= inc.closed_at + 7 * 86400000 : true)
    );

    // Find payment failures during or shortly after
    const relatedFailures = paymentFailures.filter(pf =>
      impactedAccountIds.includes(pf.account_id) &&
      pf.timestamp >= inc.opened_at &&
      pf.timestamp <= (inc.closed_at || Date.now()) + 3 * 86400000
    );

    if (relatedCredits.length === 0 && relatedFailures.length === 0) continue;

    const totalCredits = relatedCredits.reduce((s, cm) => s + cm.amount, 0);
    const totalFailed = relatedFailures.reduce((s, pf) => s + (pf.amount || 0), 0);

    correlations.push({
      incident_id: inc.id,
      incident_title: inc.title,
      severity: inc.severity,
      impacted_accounts: impactedAccountIds.length,
      credit_memos_issued: relatedCredits.length,
      total_credit_amount: totalCredits,
      payment_failures_triggered: relatedFailures.length,
      total_failed_amount: totalFailed,
      total_billing_impact: totalCredits + totalFailed,
      accounts_affected: [...new Set([...relatedCredits.map(c => c.account_id), ...relatedFailures.map(f => f.account_id)])],
      credit_memos: relatedCredits.map(c => ({ id: c.id, account: c.account_name, amount: c.amount })),
    });
  }

  correlations.sort((a, b) => b.total_billing_impact - a.total_billing_impact);
  return correlations;
}

export function billingIncidentSummary(correlations) {
  let totalCredits = 0, totalFailures = 0;
  const bySeverity = {};

  for (const c of correlations) {
    totalCredits += c.total_credit_amount;
    totalFailures += c.total_failed_amount;
    bySeverity[c.severity] = (bySeverity[c.severity] || 0) + 1;
  }

  return {
    total_correlated: correlations.length,
    total_credit_amount: totalCredits,
    total_failed_amount: totalFailures,
    total_billing_impact: totalCredits + totalFailures,
    bySeverity,
    top_impacts: correlations.slice(0, 5),
  };
}
