// SLA priority queue — ranks open incidents and tickets by breach severity.
import { detectTicketSlaBreaches, detectIncidentSlaBreaches } from "../scoring/sla-detection.js";

export function buildSlaQueue(tickets, incidents) {
  const ticketBreaches = detectTicketSlaBreaches(tickets);
  const incidentBreaches = detectIncidentSlaBreaches(incidents);

  // Score each breach for queue priority
  const queue = [];

  for (const b of ticketBreaches) {
    const t = tickets.find(tk => tk.id === b.ticket_id);
    if (!t) continue;
    const severityWeight = { critical: 100, high: 60, normal: 30, low: 10 };
    let score = (severityWeight[b.severity] || 30) + b.over_by_h * 5;
    if (b.type === "first_response" && b.severity === "critical") score += 40;
    if (b.type === "resolution") score += 15;
    queue.push({
      type: "ticket",
      id: b.ticket_id,
      account_name: b.account_name,
      title: t.title,
      breach_type: b.type,
      severity: b.severity,
      over_by_h: b.over_by_h,
      score: Math.round(score),
      created_at: t.created_at,
    });
  }

  for (const b of incidentBreaches) {
    const inc = incidents.find(i => i.id === b.incident_id);
    if (!inc) continue;
    const severityWeight = { sev0: 200, sev1: 120, sev2: 60, sev3: 20 };
    let score = (severityWeight[b.severity] || 60) + b.over_by_h * 10;
    if (b.type === "open_too_long") score += 30;
    queue.push({
      type: "incident",
      id: b.incident_id,
      account_name: inc.title,
      title: inc.title,
      breach_type: b.type,
      severity: b.severity,
      over_by_h: b.over_by_h,
      score: Math.round(score),
      created_at: inc.opened_at,
    });
  }

  queue.sort((a, b) => b.score - a.score);
  return queue;
}

export function slaQueueSummary(queue) {
  const byType = { ticket: 0, incident: 0 };
  const bySeverity = {};
  let totalOverByH = 0;
  for (const item of queue) {
    byType[item.type] = (byType[item.type] || 0) + 1;
    bySeverity[item.severity] = (bySeverity[item.severity] || 0) + 1;
    totalOverByH += item.over_by_h;
  }
  return {
    total_breaches: queue.length,
    byType,
    bySeverity,
    total_over_by_hours: parseFloat(totalOverByH.toFixed(1)),
    top_breach: queue[0] || null,
    critical_breaches: queue.filter(q => q.severity === "sev0" || q.severity === "critical").length,
  };
}
