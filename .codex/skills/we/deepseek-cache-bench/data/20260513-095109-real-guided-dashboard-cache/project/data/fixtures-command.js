// Command Center fixtures — on-call, escalation policies, runbooks, comms, postmortems.
const NOW = Date.now();
const HOUR = 3600000;
const DAY = 86400000;

let s = 499;
function nx() { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; }
function pick(arr) { return arr[Math.floor(nx() * arr.length)]; }
function intBetween(a, b) { return Math.floor(a + nx() * (b - a + 1)); }

// ---- On-Call Schedule (weekly rotation for next 14 days) ----
export function seedOnCallSchedule() {
  const teams = ["sre", "platform", "security", "sre-secondary", "platform-secondary"];
  const people = {
    sre: ["sam.owens", "dana.zhou", "lee.patel"],
    platform: ["noah.garcia", "priya.shah", "wei.zhang"],
    security: ["alex.torres", "jordan.blake"],
  };

  const schedule = [];
  for (const team of teams) {
    const isSecondary = team.includes("secondary");
    const primaryTeam = team.replace("-secondary", "");
    const teamPeople = people[primaryTeam] || ["oncall-rotation"];

    for (let day = 0; day < 14; day++) {
      const start = new Date(NOW + day * DAY);
      start.setHours(isSecondary ? 20 : 8, 0, 0, 0);
      const end = new Date(start.getTime() + 12 * HOUR);
      schedule.push({
        team,
        person: teamPeople[day % teamPeople.length],
        start: start.getTime(),
        end: end.getTime(),
      });
    }
  }
  return schedule;
}

// ---- Escalation Policies ----
export function seedEscalationPolicies() {
  return {
    sev0: {
      tiers: [
        { level: 1, escalate_after_m: 15, route_to: "sre-secondary" },
        { level: 2, escalate_after_m: 30, route_to: "platform" },
        { level: 3, escalate_after_m: 60, route_to: "engineering_manager" },
      ],
    },
    sev1: {
      tiers: [
        { level: 1, escalate_after_m: 60, route_to: "sre-secondary" },
        { level: 2, escalate_after_m: 120, route_to: "engineering_manager" },
      ],
    },
    sev2: {
      tiers: [
        { level: 1, escalate_after_m: 240, route_to: "platform" },
      ],
    },
    sev3: {
      tiers: [
        { level: 1, escalate_after_m: 480, route_to: "platform" },
      ],
    },
    default: {
      tiers: [
        { level: 1, escalate_after_m: 120, route_to: "platform" },
      ],
    },
  };
}

// ---- Service Ownership ----
export function seedServiceOwnership() {
  return {
    "api-gateway":       { team: "platform", primary: "noah.garcia", secondary: "wei.zhang" },
    "billing-worker":    { team: "platform", primary: "priya.shah", secondary: "noah.garcia" },
    "web-app":           { team: "platform", primary: "wei.zhang", secondary: "priya.shah" },
    "auth-service":      { team: "security", primary: "alex.torres", secondary: "jordan.blake" },
    "reporting-engine":  { team: "sre", primary: "lee.patel", secondary: "sam.owens" },
    "notification-service": { team: "sre", primary: "sam.owens", secondary: "lee.patel" },
    database:            { team: "sre", primary: "dana.zhou", secondary: "sam.owens" },
    infrastructure:      { team: "platform", primary: "noah.garcia", secondary: "wei.zhang" },
    "background-jobs":   { team: "sre", primary: "lee.patel", secondary: "dana.zhou" },
  };
}

// ---- Incident-to-Account Impact Mapping ----
export function seedIncidentAccountImpact(accounts, incidents) {
  const mapping = {};
  for (const inc of incidents) {
    const affectedIds = [];
    const count = intBetween(inc.severity === "sev0" ? 15 : inc.severity === "sev1" ? 8 : 2, inc.affected_accounts || 5);
    const active = accounts.filter(a => a.health !== "churned");
    for (let i = 0; i < Math.min(count, active.length); i++) {
      const idx = intBetween(0, active.length - 1);
      if (!affectedIds.includes(active[idx].id)) {
        affectedIds.push(active[idx].id);
      }
    }
    mapping[inc.id] = affectedIds;
  }
  return mapping;
}

// ---- Status Page Updates (historical, for resolved incidents) ----
export function seedStatusPageUpdates(incidents) {
  const updates = [];
  for (const inc of incidents) {
    if (inc.status !== "closed" && inc.status !== "resolved") continue;
    updates.push({
      incident_id: inc.id,
      title: `[Resolved] ${inc.title}`,
      body: `This incident has been resolved. Services are fully operational.`,
      published_at: inc.closed_at || inc.opened_at + 3600000,
      type: "resolution",
    });
    updates.push({
      incident_id: inc.id,
      title: `[Investigating] ${inc.title}`,
      body: `We are investigating an issue with ${inc.title.toLowerCase()}.`,
      published_at: inc.opened_at + intBetween(5, 15) * 60000,
      type: "initial",
    });
  }
  return updates.sort((a, b) => b.published_at - a.published_at);
}

// ---- Customer Communications (generated per incident) ----
export function seedCustomerCommunications(incidents, accounts) {
  const comms = [];
  const templates = [
    "We are writing to inform you about a recent service disruption.",
    "Our team has resolved an incident that may have affected your account.",
    "We detected an anomaly that briefly impacted service performance.",
  ];
  for (const inc of incidents.filter(i => i.status === "resolved" || i.status === "closed")) {
    const count = intBetween(0, 3);
    for (let i = 0; i < count; i++) {
      const acct = pick(accounts.filter(a => a.health !== "churned"));
      comms.push({
        id: `comm_${inc.id}_${i}`,
        incident_id: inc.id,
        account_id: acct.id,
        account_name: acct.name,
        type: "email",
        subject: `Service update regarding recent incident`,
        body: pick(templates),
        sent_at: inc.closed_at ? inc.closed_at + intBetween(1, 24) * HOUR : null,
        status: pick(["sent", "sent", "draft"]),
      });
    }
  }
  return comms.sort((a, b) => (b.sent_at || 0) - (a.sent_at || 0));
}

// ---- Postmortem Tasks (extracted actions) ----
export function seedPostmortemTasks(incidents) {
  const tasks = [];
  const taskTemplates = [
    { title: "Write postmortem document", type: "documentation", priority: "high" },
    { title: "Add monitoring alert for failure mode", type: "monitoring", priority: "medium" },
    { title: "Implement permanent fix for root cause", type: "permanent_fix", priority: "high" },
    { title: "Update runbook with new diagnostic steps", type: "documentation", priority: "low" },
    { title: "Follow up with impacted accounts", type: "communication", priority: "medium" },
    { title: "Review SLA breach and process gaps", type: "sla_review", priority: "medium" },
  ];
  for (const inc of incidents.filter(i => i.status === "resolved" || i.status === "closed")) {
    const count = intBetween(2, 5);
    for (let i = 0; i < count; i++) {
      const tmpl = pick(taskTemplates);
      tasks.push({
        id: `pm_${inc.id}_${i}`,
        incident_id: inc.id,
        title: tmpl.title,
        type: tmpl.type,
        priority: tmpl.priority,
        completed: nx() > 0.5,
        assignee: pick(["sam.owens", "dana.zhou", "lee.patel", "noah.garcia"]),
        due_date: (inc.closed_at || inc.opened_at) + intBetween(3, 14) * DAY,
      });
    }
  }
  return tasks.sort((a, b) => a.due_date - b.due_date);
}

// Assemble
export function seedAllCommandFixtures(state) {
  return {
    onCallSchedule: seedOnCallSchedule(),
    escalationPolicies: seedEscalationPolicies(),
    serviceOwnership: seedServiceOwnership(),
    incidentAccountImpact: seedIncidentAccountImpact(state.accounts, state.incidents),
    statusPageUpdates: seedStatusPageUpdates(state.incidents),
    customerCommunications: seedCustomerCommunications(state.incidents, state.accounts),
    postmortemTasks: seedPostmortemTasks(state.incidents),
  };
}
