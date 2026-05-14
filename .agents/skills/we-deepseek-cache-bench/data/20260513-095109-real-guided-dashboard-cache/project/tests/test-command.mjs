// Command Center — domain module tests.
import { routeEscalation, buildTriageCard, triageSummary } from "../scripts/command-center/escalation-routing.js";
import { buildSlaQueue, slaQueueSummary } from "../scripts/command-center/sla-priority-queue.js";
import { normalizeTimeline, timelineSummary } from "../scripts/command-center/timeline-normalization.js";
import { estimateBlastRadius } from "../scripts/command-center/blast-radius.js";
import { generateStatusUpdate, generateCustomerCommunication, batchGenerateCustomerComms } from "../scripts/command-center/communication-drafts.js";
import { recommendRunbooks } from "../scripts/command-center/runbook-recommendation.js";
import { extractPostmortemActions, batchExtractActions, postmortemSummary } from "../scripts/command-center/postmortem-actions.js";

const NOW = Date.now();
const HOUR = 3600000;
const DAY = 86400000;
let passed = 0, failed = 0, total = 0;

function assert(condition, label) { total++; if (condition) passed++; else { failed++; console.error(`  FAIL: ${label}`); } }
function eq(actual, expected, label) { total++; const a = JSON.stringify(actual), e = JSON.stringify(expected); if (a === e) passed++; else { failed++; console.error(`  FAIL: ${label} — expected ${e}, got ${a}`); } }

// ---- Setup ----
const onCallSchedule = [
  { team: "sre", person: "sam.owens", start: NOW - 4 * HOUR, end: NOW + 8 * HOUR },
  { team: "platform", person: "noah.garcia", start: NOW - 2 * HOUR, end: NOW + 10 * HOUR },
  { team: "sre-secondary", person: "lee.patel", start: NOW - 1 * HOUR, end: NOW + 11 * HOUR },
];
const escalationPolicies = {
  sev0: { tiers: [{ level: 1, escalate_after_m: 15, route_to: "sre-secondary" }, { level: 2, escalate_after_m: 30, route_to: "platform" }] },
  sev1: { tiers: [{ level: 1, escalate_after_m: 60, route_to: "platform" }] },
  default: { tiers: [{ level: 1, escalate_after_m: 120, route_to: "platform" }] },
};
const serviceOwnership = {
  "api-gateway": { team: "platform", primary: "noah.garcia", secondary: "wei.zhang" },
  database: { team: "sre", primary: "dana.zhou", secondary: "sam.owens" },
};

const incident = {
  id: "inc_0001", title: "API latency spike in us-east-1", severity: "sev1",
  status: "investigating", opened_at: NOW - 50 * 60000, duration_m: 50,
  affected_accounts: 12, service: "api-gateway",
};

const accounts = [
  { id: "a1", name: "Alpha Corp", mrr: 18000, health: "healthy" },
  { id: "a2", name: "Beta LLC", mrr: 3500, health: "at_risk" },
  { id: "a3", name: "Gamma Inc", mrr: 1200, health: "healthy" },
  { id: "a4", name: "Delta Co", mrr: 7500, health: "churned" },
];

const tickets = [
  { id: "t1", account_name: "Alpha Corp", account_id: "a1", title: "Export timeout", priority: "critical", status: "open", created_at: NOW - 5 * HOUR, resolved_at: null, comments: [] },
  { id: "t2", account_name: "Beta LLC", account_id: "a2", title: "SSO failure", priority: "high", status: "open", created_at: NOW - 20 * HOUR, resolved_at: NOW - 10 * HOUR, comments: [{ body: "Looking into this" }] },
  { id: "t3", account_name: "Gamma Inc", account_id: "a3", title: "Minor bug", priority: "low", status: "resolved", created_at: NOW - 48 * HOUR, resolved_at: NOW - 24 * HOUR, comments: [] },
];
const slaIncidents = [
  { id: "inc_0001", title: "API latency spike", severity: "sev1", status: "investigating", opened_at: NOW - 5 * HOUR, closed_at: null, duration_m: 300 },
  { id: "inc_0002", title: "DB pool exhaust", severity: "sev2", status: "closed", opened_at: NOW - 24 * HOUR, closed_at: NOW - 8 * HOUR, duration_m: 960 },
];

// ==================== Escalation Routing ====================
console.log("\n=== Escalation Routing Tests ===");

const route = routeEscalation(incident, onCallSchedule, escalationPolicies, serviceOwnership);
eq(route.primary_contact, "noah.garcia", "On-call is noah.garcia for platform/api-gateway");
eq(route.team, "platform", "Team is platform");
eq(route.service, "api-gateway", "Service detected");
assert(!route.escalated, "50m incident not yet escalated for sev1 (threshold 60m)");

const oldIncident = { ...incident, opened_at: NOW - 120 * 60000, duration_m: 120 };
const route2 = routeEscalation(oldIncident, onCallSchedule, escalationPolicies, serviceOwnership);
assert(route2.escalated, "120m sev1 incident IS escalated");
eq(route2.escalation_tier, 1, "Escalated to tier 1");

const sev0Inc = { ...incident, severity: "sev0", opened_at: NOW - 30 * 60000, duration_m: 30 };
const route3 = routeEscalation(sev0Inc, onCallSchedule, escalationPolicies, serviceOwnership);
assert(route3.escalated, "30m sev0 is escalated (threshold 15m)");
assert(route3.recommend_page, "Sev0 recommends page");

// Triage card
const card = buildTriageCard(incident, route, null);
eq(card.severity, "sev1", "Card severity correct");
eq(card.on_call, "noah.garcia", "Card on-call correct");
assert(card.elapsed_m >= 50, "Card elapsed time");

// Triage summary
const cards = [card, buildTriageCard(sev0Inc, route3, null)];
const tSum = triageSummary(cards);
eq(tSum.total_active, 2, "Two active cards");
eq(tSum.bySeverity.sev0, 1, "One sev0");
eq(tSum.bySeverity.sev1, 1, "One sev1");

// SLA status
const breachingCard = buildTriageCard({ ...incident, duration_m: 300 }, route, null);
assert(breachingCard.sla_status === "breached", "SLA breached after 300m for sev1");

// ==================== SLA Priority Queue ====================
console.log("\n=== SLA Priority Queue Tests ===");

const queue = buildSlaQueue(tickets, slaIncidents);
assert(queue.length > 0, "SLA queue has entries");
const topItem = queue[0];
assert(topItem.score > 0, "Top item has score > 0");
assert(queue.some(q => q.type === "incident"), "Queue has incident breaches");
assert(queue.some(q => q.type === "ticket"), "Queue has ticket breaches");

const qs = slaQueueSummary(queue);
assert(qs.total_breaches > 0, "Queue summary has breaches");
assert(qs.critical_breaches >= 0, "Critical breach count present");

// ==================== Timeline Normalization ====================
console.log("\n=== Timeline Normalization Tests ===");

const updates = [
  { incident_id: "inc_0001", author: "sam.owens", message: "Investigating elevated errors", timestamp: incident.opened_at + 5 * 60000 },
  { incident_id: "inc_0001", author: "lee.patel", message: "Root cause: cache failure", timestamp: incident.opened_at + 25 * 60000 },
];
const relatedTickets = [tickets[0]]; // t1 is related
const ticketComments = [
  { ticket_id: "t1", author: "alex.chen", body: "Looking into this now.", timestamp: tickets[0].created_at + 3600000 },
];

const timeline = normalizeTimeline(incident, updates, relatedTickets, ticketComments);
assert(timeline.length >= 4, "Timeline has 4+ events");
assert(timeline.some(e => e.type === "incident_opened"), "Timeline contains incident_opened");
assert(timeline.some(e => e.type === "incident_update"), "Timeline has incident updates");
assert(timeline.some(e => e.type === "ticket_linked"), "Timeline has linked ticket");
assert(timeline.every((e, i) => i === 0 || e.timestamp >= timeline[i - 1].timestamp), "Timeline is sorted");

const ts = timelineSummary(timeline);
assert(ts.total_events >= 4, "Timeline summary counts events");
assert(ts.total_duration_m > 0, "Total duration > 0");
assert(ts.first_response_m != null, "First response time detected");

// ==================== Blast Radius ====================
console.log("\n=== Blast Radius Tests ===");

const impactMap = { inc_0001: ["a1", "a2", "a3"] };
const blast = estimateBlastRadius(incident, accounts, tickets, impactMap);
assert(blast.blast_score > 0, "Blast score > 0");
eq(blast.impacted_account_count, 3, "3 impacted accounts");
assert(blast.impacted_mrr > 0, "Impacted MRR > 0");
eq(blast.top_impacted.length, 3, "Top impacted has 3 entries");
eq(blast.top_impacted[0].name, "Alpha Corp", "Alpha is top impacted (highest MRR)");
assert(blast.related_open_tickets >= 0, "Related tickets count");

// ==================== Communication Drafts ====================
console.log("\n=== Communication Drafts Tests ===");

const statusUpdate = generateStatusUpdate(incident, timeline, route, blast);
eq(statusUpdate.status, "investigating", "Status update reflects investigating");
assert(statusUpdate.body.length > 50, "Status update has meaningful body");
assert(statusUpdate.title.includes("Investigating"), "Title says investigating");

const customerComm = generateCustomerCommunication(incident, accounts[0], blast);
assert(customerComm.should_send, "Sev1 incident comm should send");
assert(customerComm.subject.length > 10, "Subject line present");

const resolvedInc = { ...incident, status: "resolved", closed_at: NOW };
const resolvedUpdate = generateStatusUpdate(resolvedInc, timeline, route, blast);
eq(resolvedUpdate.status, "resolved", "Resolved status update");

const batchComms = batchGenerateCustomerComms(incident, accounts, blast);
assert(batchComms.length > 0, "Batch generates comms for impacted accounts");

// ==================== Runbook Recommendation ====================
console.log("\n=== Runbook Recommendation Tests ===");

const rbIncident = { title: "API latency spike in us-east-1", severity: "sev1" };
const runbooks = recommendRunbooks(rbIncident);
assert(runbooks.length > 0, "Runbooks recommended");
assert(runbooks.some(r => r.runbook_id === "rb_api_latency"), "API latency runbook matched");
assert(runbooks[0].steps.length > 0, "Runbook has steps");

const dbIncident = { title: "Database connection pool exhaustion", severity: "sev0" };
const dbRunbooks = recommendRunbooks(dbIncident);
assert(dbRunbooks.some(r => r.runbook_id === "rb_db_connection_pool"), "DB runbook matched");

const unknownIncident = { title: "Unknown failure mode", severity: "sev3" };
const genericRunbooks = recommendRunbooks(unknownIncident);
assert(genericRunbooks.length > 0, "Generic runbook for unknown incident");

// ==================== Postmortem Actions ====================
console.log("\n=== Postmortem Actions Tests ===");

const resolved = { ...incident, status: "resolved", closed_at: NOW, duration_m: 120 };
const tSummary = { total_events: 6, has_gaps: true, gaps: [{ gap_minutes: 45 }], first_response_m: 12 };
const pmActions = extractPostmortemActions(resolved, tSummary, [runbooks[0]], blast);
assert(pmActions.length >= 2, "2+ postmortem actions extracted");
assert(pmActions.some(a => a.type === "documentation"), "Documentation task");
assert(pmActions.some(a => a.type === "process"), "Process improvement task (gaps found)");

const batchPM = batchExtractActions([resolved], { inc_0001: tSummary }, { inc_0001: runbooks }, { inc_0001: blast });
eq(batchPM.length, 1, "Batch extracts for 1 incident");
assert(batchPM[0].actions.length >= 2, "2+ actions per incident");

const pmSum = postmortemSummary(batchPM);
assert(pmSum.total_incidents_reviewed === 1, "1 incident reviewed");
assert(pmSum.total_actions >= 2, "2+ total actions");

// ==================== Results ====================
console.log(`\n=== Results: ${passed}/${total} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
