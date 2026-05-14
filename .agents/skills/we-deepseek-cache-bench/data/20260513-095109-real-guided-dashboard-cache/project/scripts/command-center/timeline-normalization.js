// Timeline normalization — merges incident updates and ticket comments into
// a unified, time-sorted event stream for the command center view.

export function normalizeTimeline(incident, incidentUpdates, relatedTickets, ticketComments) {
  const events = [];

  // Incident opened
  events.push({
    timestamp: incident.opened_at,
    type: "incident_opened",
    source_id: incident.id,
    source_type: "incident",
    summary: `Incident opened: ${incident.title}`,
    severity: incident.severity,
    author: null,
  });

  // Incident updates
  for (const update of (incidentUpdates || []).filter(u => u.incident_id === incident.id)) {
    events.push({
      timestamp: update.timestamp,
      type: "incident_update",
      source_id: incident.id,
      source_type: "incident",
      summary: update.message,
      severity: incident.severity,
      author: update.author,
    });
  }

  // Related ticket events
  for (const ticket of (relatedTickets || [])) {
    events.push({
      timestamp: ticket.created_at,
      type: "ticket_linked",
      source_id: ticket.id,
      source_type: "ticket",
      summary: `Support ticket linked: ${ticket.title}`,
      severity: ticket.priority,
      author: ticket.account_name,
    });
    for (const comment of (ticketComments || []).filter(c => c.ticket_id === ticket.id)) {
      events.push({
        timestamp: comment.timestamp,
        type: "ticket_comment",
        source_id: ticket.id,
        source_type: "ticket",
        summary: comment.body,
        severity: ticket.priority,
        author: comment.author,
      });
    }
    if (ticket.resolved_at) {
      events.push({
        timestamp: ticket.resolved_at,
        type: "ticket_resolved",
        source_id: ticket.id,
        source_type: "ticket",
        summary: "Ticket resolved",
        severity: ticket.priority,
        author: null,
      });
    }
  }

  // Incident closed
  if (incident.closed_at) {
    events.push({
      timestamp: incident.closed_at,
      type: "incident_closed",
      source_id: incident.id,
      source_type: "incident",
      summary: "Incident closed",
      severity: incident.severity,
      author: null,
    });
  }

  events.sort((a, b) => a.timestamp - b.timestamp);
  return events;
}

export function timelineSummary(events) {
  const firstEvent = events[0];
  const lastEvent = events[events.length - 1];
  const totalDurationM = firstEvent && lastEvent
    ? Math.round((lastEvent.timestamp - firstEvent.timestamp) / 60000)
    : 0;

  const typeCounts = {};
  for (const e of events) {
    typeCounts[e.type] = (typeCounts[e.type] || 0) + 1;
  }

  // Identify gaps (periods > 30min with no events)
  const gaps = [];
  for (let i = 1; i < events.length; i++) {
    const gapM = (events[i].timestamp - events[i - 1].timestamp) / 60000;
    if (gapM > 30) {
      gaps.push({
        after_event: events[i - 1].type,
        before_event: events[i].type,
        gap_minutes: Math.round(gapM),
        start: events[i - 1].timestamp,
        end: events[i].timestamp,
      });
    }
  }

  // Identify first response time (first human update after open)
  const firstHumanUpdate = events.find(e =>
    e.type === "incident_update" || e.type === "ticket_comment"
  );
  const firstResponseM = firstHumanUpdate
    ? Math.round((firstHumanUpdate.timestamp - firstEvent.timestamp) / 60000)
    : null;

  return {
    total_events: events.length,
    total_duration_m: totalDurationM,
    type_counts: typeCounts,
    gaps: gaps.length > 0 ? gaps : null,
    first_response_m: firstResponseM,
    has_gaps: gaps.length > 0,
  };
}
