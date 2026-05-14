// Usage anomaly triage — categorizes and prioritizes usage anomalies for review.

const DAY = 86400000;
const NOW = Date.now();

export function triageAnomalies(anomalies, accounts, usageEvents) {
  const triaged = [];

  for (const anom of (anomalies || [])) {
    const account = accounts.find(a => a.id === anom.account_id);
    if (!account) continue;

    // Determine impact
    const events = (usageEvents || []).filter(e => e.account_id === anom.account_id);
    const recentEvents = events.filter(e => e.timestamp > anom.timestamp - 7 * DAY && e.timestamp < anom.timestamp + 7 * DAY);
    const avgBefore = events.filter(e => e.timestamp < anom.timestamp - 3 * DAY)
      .reduce((s, e) => s + e.value, 0) / Math.max(1, events.filter(e => e.timestamp < anom.timestamp - 3 * DAY).length);
    const avgAfter = recentEvents.filter(e => e.timestamp > anom.timestamp)
      .reduce((s, e) => s + e.value, 0) / Math.max(1, recentEvents.filter(e => e.timestamp > anom.timestamp).length);

    const resolved = Math.abs(avgAfter - avgBefore) < 5;

    // Priority
    let priority;
    if (anom.type === "drop" && account.mrr > 5000) priority = "critical";
    else if (anom.type === "drop" || (anom.type === "gap" && anom.severity === "high")) priority = "high";
    else if (anom.type === "spike") priority = "medium";
    else priority = "low";

    triaged.push({
      anomaly_id: anom.id || `anom_${anom.account_id}_${anom.timestamp}`,
      account_id: anom.account_id,
      account_name: account.name,
      mrr: account.mrr,
      health: account.health,
      type: anom.type,
      severity: anom.severity,
      description: anom.description,
      timestamp: anom.timestamp,
      days_ago: Math.round((NOW - anom.timestamp) / DAY),
      resolved,
      priority,
      action: priority === "critical"
        ? "Immediate CSM outreach — verify account health"
        : priority === "high"
          ? "Review within 24 hours — potential churn signal"
          : priority === "medium"
            ? "Monitor — flag for next check-in"
            : "Log for review",
    });
  }

  triaged.sort((a, b) => {
    const p = { critical: 0, high: 1, medium: 2, low: 3 };
    return (p[a.priority] ?? 99) - (p[b.priority] ?? 99);
  });

  return triaged;
}

export function anomalyTriageSummary(triaged) {
  const byPriority = {};
  let unresolved = 0;
  for (const t of triaged) {
    byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
    if (!t.resolved) unresolved++;
  }
  return {
    total: triaged.length,
    unresolved,
    byPriority,
    critical: byPriority.critical || 0,
    high: byPriority.high || 0,
    top_anomalies: triaged.slice(0, 10),
  };
}
