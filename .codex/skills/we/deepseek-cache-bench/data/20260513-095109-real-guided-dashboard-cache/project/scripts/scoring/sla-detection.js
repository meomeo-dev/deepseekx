// Northstar Ops Console — SLA breach detection for tickets and incidents.

const HOUR_MS = 3600000;

// SLA targets by priority/severity (hours to first response, hours to resolution)
const SLA_TARGETS = {
  ticket: {
    critical: { first_response_h: 0.5, resolution_h: 4 },
    high:     { first_response_h: 2,   resolution_h: 8 },
    normal:   { first_response_h: 4,   resolution_h: 24 },
    low:      { first_response_h: 8,   resolution_h: 72 },
  },
  incident: {
    sev0: { ack_h: 0.25, resolution_h: 1 },
    sev1: { ack_h: 0.5,  resolution_h: 4 },
    sev2: { ack_h: 2,    resolution_h: 8 },
    sev3: { ack_h: 8,    resolution_h: 24 },
  },
};

export function detectTicketSlaBreaches(tickets) {
  const breaches = [];
  for (const t of tickets) {
    const target = SLA_TARGETS.ticket[t.priority];
    if (!target) continue;

    const now = Date.now();
    const ageH = (now - t.created_at) / HOUR_MS;

    // First response breach (simplified: ticket is open and has no comments = no response)
    const hasResponse = t.comments && t.comments.length > 0;
    if (!hasResponse && t.status !== "resolved" && ageH > target.first_response_h) {
      breaches.push({
        ticket_id: t.id,
        account_name: t.account_name,
        type: "first_response",
        target_h: target.first_response_h,
        elapsed_h: parseFloat(ageH.toFixed(1)),
        severity: t.priority,
        over_by_h: parseFloat((ageH - target.first_response_h).toFixed(1)),
      });
    }

    // Resolution breach
    if (t.status !== "resolved" && ageH > target.resolution_h) {
      breaches.push({
        ticket_id: t.id,
        account_name: t.account_name,
        type: "resolution",
        target_h: target.resolution_h,
        elapsed_h: parseFloat(ageH.toFixed(1)),
        severity: t.priority,
        over_by_h: parseFloat((ageH - target.resolution_h).toFixed(1)),
      });
    }

    // Resolved late
    if (t.resolved_at) {
      const resolutionH = (t.resolved_at - t.created_at) / HOUR_MS;
      if (resolutionH > target.resolution_h) {
        breaches.push({
          ticket_id: t.id,
          account_name: t.account_name,
          type: "resolved_late",
          target_h: target.resolution_h,
          actual_h: parseFloat(resolutionH.toFixed(1)),
          severity: t.priority,
          over_by_h: parseFloat((resolutionH - target.resolution_h).toFixed(1)),
        });
      }
    }
  }
  return breaches;
}

export function detectIncidentSlaBreaches(incidents) {
  const breaches = [];
  for (const inc of incidents) {
    const target = SLA_TARGETS.incident[inc.severity];
    if (!target) continue;

    if (inc.closed_at && inc.duration_m != null) {
      const durationH = inc.duration_m / 60;
      if (durationH > target.resolution_h) {
        breaches.push({
          incident_id: inc.id,
          type: "resolution",
          target_h: target.resolution_h,
          actual_h: parseFloat(durationH.toFixed(1)),
          severity: inc.severity,
          over_by_h: parseFloat((durationH - target.resolution_h).toFixed(1)),
        });
      }
    } else if (inc.status !== "closed" && inc.status !== "resolved") {
      const ageH = (Date.now() - inc.opened_at) / HOUR_MS;
      if (ageH > target.resolution_h) {
        breaches.push({
          incident_id: inc.id,
          type: "open_too_long",
          target_h: target.resolution_h,
          elapsed_h: parseFloat(ageH.toFixed(1)),
          severity: inc.severity,
          over_by_h: parseFloat((ageH - target.resolution_h).toFixed(1)),
        });
      }
    }
  }
  return breaches;
}

export function slaHealthSummary(tickets, incidents) {
  const ticketBreaches = detectTicketSlaBreaches(tickets);
  const incidentBreaches = detectIncidentSlaBreaches(incidents);
  const allBreaches = [...ticketBreaches, ...incidentBreaches];

  return {
    total_breaches: allBreaches.length,
    active_breaches: allBreaches.filter(b => b.type !== "resolved_late"),
    ticket_breaches: ticketBreaches,
    incident_breaches: incidentBreaches,
    breach_rate: tickets.length > 0
      ? parseFloat((ticketBreaches.filter(b => b.type !== "resolved_late").length / tickets.length * 100).toFixed(1))
      : 0,
  };
}
