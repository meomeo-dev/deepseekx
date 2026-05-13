// Escalation routing — determines who should handle an incident or escalation.
// Models on-call rotation, service ownership, severity-based routing.

export function routeEscalation(incident, onCallSchedule, escalationPolicies, serviceOwnership) {
  const now = Date.now();

  // Find who owns the affected service
  const service = incident.service || inferService(incident);
  const owners = serviceOwnership[service] || { team: "sre", primary: null, secondary: null };

  // Check on-call schedule
  const onCall = findOnCall(onCallSchedule, owners.team, now);
  const secondaryOnCall = findOnCall(onCallSchedule, owners.team + "-secondary", now);

  // Apply escalation policy based on severity and elapsed time
  const policy = escalationPolicies[incident.severity] || escalationPolicies["default"];
  const elapsedM = incident.duration_m || ((now - incident.opened_at) / 60000);

  let currentTier = 0;
  let escalatedTo = null;
  let escalationReason = null;

  if (policy) {
    for (const tier of policy.tiers) {
      if (elapsedM >= tier.escalate_after_m) {
        currentTier = tier.level;
        escalatedTo = tier.route_to;
      }
    }
    if (currentTier > 0) {
      escalationReason = `Escalated to tier ${currentTier} after ${elapsedM.toFixed(0)}m`;
    }
  }

  // Resolve actual contacts
  const route = {
    primary_contact: onCall || owners.primary || "sre-team",
    secondary_contact: secondaryOnCall || owners.secondary || null,
    team: owners.team,
    service,
    escalated: currentTier > 0,
    escalation_tier: currentTier,
    escalated_to: resolveContact(escalatedTo, onCallSchedule, now),
    escalation_reason: escalationReason,
    recommend_page: incident.severity === "sev0" || (incident.severity === "sev1" && elapsedM > 15),
  };

  return route;
}

function findOnCall(schedule, team, now) {
  const entries = (schedule || []).filter(e => e.team === team);
  for (const entry of entries) {
    if (now >= entry.start && now < entry.end) return entry.person;
  }
  return null;
}

function resolveContact(role, schedule, now) {
  if (!role) return null;
  // If role is a team name, find who's on call for that team
  if (typeof role === "string" && !role.includes("@")) {
    return findOnCall(schedule, role, now) || role;
  }
  return role;
}

function inferService(incident) {
  const title = (incident.title || "").toLowerCase();
  if (title.includes("api") || title.includes("gateway")) return "api-gateway";
  if (title.includes("database") || title.includes("db") || title.includes("connection pool")) return "database";
  if (title.includes("cache") || title.includes("cdn")) return "infrastructure";
  if (title.includes("auth") || title.includes("sso") || title.includes("tls")) return "auth-service";
  if (title.includes("billing") || title.includes("payment")) return "billing-worker";
  if (title.includes("report") || title.includes("export")) return "reporting-engine";
  if (title.includes("webhook") || title.includes("notification")) return "notification-service";
  if (title.includes("queue") || title.includes("job") || title.includes("worker")) return "background-jobs";
  return "web-app";
}

export function buildTriageCard(incident, route, impact) {
  const elapsedM = incident.duration_m || Math.round((Date.now() - incident.opened_at) / 60000);
  return {
    incident_id: incident.id,
    title: incident.title,
    severity: incident.severity,
    status: incident.status,
    elapsed_m: elapsedM,
    on_call: route.primary_contact,
    team: route.team,
    service: route.service,
    escalated: route.escalated,
    escalation_tier: route.escalation_tier,
    page: route.recommend_page,
    affected_accounts: incident.affected_accounts || 0,
    impact_score: impact ? impact.score : null,
    impact_level: impact ? impact.level : null,
    sla_status: elapsedM > slaTarget(incident.severity) ? "breached" : "ok",
  };
}

function slaTarget(severity) {
  return { sev0: 60, sev1: 240, sev2: 480, sev3: 1440 }[severity] || 480;
}

export function triageSummary(cards) {
  const bySeverity = { sev0: 0, sev1: 0, sev2: 0, sev3: 0 };
  const byStatus = {};
  let breachedSLA = 0, escalated = 0, needsPage = 0;

  for (const c of cards) {
    bySeverity[c.severity] = (bySeverity[c.severity] || 0) + 1;
    byStatus[c.status] = (byStatus[c.status] || 0) + 1;
    if (c.sla_status === "breached") breachedSLA++;
    if (c.escalated) escalated++;
    if (c.page) needsPage++;
  }

  return {
    total_active: cards.length,
    bySeverity,
    byStatus,
    breached_sla: breachedSLA,
    escalated,
    needs_page: needsPage,
    cards,
  };
}
