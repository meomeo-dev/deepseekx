// Northstar Ops Console — Test runner (ESM, no network).
// Exercises scoring, filtering, sorting, and forecast functions.

import { computeHealthScore, computeEngagementScore, churnRiskCategory } from "../scripts/scoring/account-scoring.js";
import { forecastRenewal, aggregateRenewalForecast } from "../scripts/scoring/renewal-forecast.js";
import { detectTicketSlaBreaches, detectIncidentSlaBreaches, slaHealthSummary } from "../scripts/scoring/sla-detection.js";
import { scoreIncidentImpact, summarizeIncidentImpacts } from "../scripts/scoring/incident-impact.js";
import { scoreDeployRisk, aggregateDeployRisk } from "../scripts/scoring/deploy-risk.js";
import { decideExperiment, batchDecide } from "../scripts/scoring/experiment-decision.js";
import { FilterState } from "../data/filters.js";

const NOW = Date.now();
const DAY = 86400000;
let passed = 0, failed = 0, total = 0;

function assert(condition, label) {
  total++;
  if (condition) { passed++; }
  else { failed++; console.error(`  FAIL: ${label}`); }
}

function eq(actual, expected, label) {
  total++;
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; }
  else { failed++; console.error(`  FAIL: ${label} — expected ${e}, got ${a}`); }
}

// ==================== Account Scoring ====================
console.log("\n=== Account Scoring Tests ===");

const mockAccount = { id: "a1", name: "TestCo", mrr: 5000, health: "healthy", usage_pct: 80, feature_adoption: 0.6 };
const mockTickets = [
  { status: "open", priority: "critical", created_at: NOW - 3600000, resolved_at: null, satisfaction_score: null },
  { status: "open", priority: "high", created_at: NOW - 7200000, resolved_at: null, satisfaction_score: null },
  { status: "resolved", priority: "normal", created_at: NOW - 86400000, resolved_at: NOW - 43200000, satisfaction_score: 2 },
];
const mockUsage = [];
for (let d = 0; d < 60; d++) {
  mockUsage.push({ timestamp: NOW - d * DAY, value: 20 + d * 1.0, event_type: "login" });
}

const hs = computeHealthScore(mockAccount, mockTickets, mockUsage);
assert(hs.score < 100, "Health score reflects deductions");
assert(hs.risk_level !== "low", "Risk level not low with critical tickets and declining usage");
assert(hs.deductions.length > 0, "Deductions present");
assert(hs.score >= 0 && hs.score <= 100, "Score in range 0-100");

const es = computeEngagementScore(mockAccount, mockUsage, mockTickets, []);
assert(es.score >= 0 && es.score <= 100, "Engagement score in range");
assert(es.active_days > 0, "Active days > 0");

const cat = churnRiskCategory({ score: 30 });
eq(cat.label, "Critical", "Score 30 = Critical");
eq(churnRiskCategory({ score: 85 }).label, "Healthy", "Score 85 = Healthy");

// ==================== Renewal Forecasting ====================
console.log("\n=== Renewal Forecasting Tests ===");

const contract = { start_date: NOW - 400 * DAY, renewal_date: NOW + 45 * DAY, success_plan_pct: 0.8 };
const rf = forecastRenewal(mockAccount, hs, es, contract);
assert(rf.probability > 0 && rf.probability < 1, "Probability in 0-1 range");
assert(rf.expected_value > 0, "Expected value positive");
assert(rf.factors.length > 0, "Factors present");
assert(rf.days_until_renewal > 0, "Days until renewal positive");

// Null contract
const rfNull = forecastRenewal(mockAccount, hs, es, null);
eq(rfNull.probability, null, "Null contract = null probability");

// Aggregate
const accounts = [
  { id: "a1", name: "Co1", mrr: 5000, health: "healthy" },
  { id: "a2", name: "Co2", mrr: 2000, health: "at_risk" },
];
const agg = aggregateRenewalForecast(accounts,
  { a1: { score: 85 }, a2: { score: 40 } },
  { a1: { score: 70 }, a2: { score: 25 } },
  { a1: contract, a2: { start_date: NOW - 200 * DAY, renewal_date: NOW + 20 * DAY, success_plan_pct: 0.2 } }
);
assert(agg.total_expected_arr > 0, "Aggregate expected ARR > 0");
assert(agg.renewal_rate_forecast > 0, "Renewal rate forecast > 0");
assert(Object.keys(agg.byRisk).length === 3, "Three risk buckets");

// ==================== SLA Detection ====================
console.log("\n=== SLA Detection Tests ===");

const slaTickets = [
  { id: "t1", account_name: "Co1", priority: "critical", status: "open", created_at: NOW - 3 * 3600000, resolved_at: null, comments: [] },
  { id: "t2", account_name: "Co1", priority: "low", status: "open", created_at: NOW - 3600000, resolved_at: null, comments: [{ body: "ok" }] },
  { id: "t3", account_name: "Co1", priority: "high", status: "resolved", created_at: NOW - 20 * 3600000, resolved_at: NOW - 10 * 3600000, comments: [] },
];
const tBreaches = detectTicketSlaBreaches(slaTickets);
assert(tBreaches.length > 0, "SLA breaches detected for overdue tickets");
const t1b = tBreaches.filter(b => b.ticket_id === "t1");
assert(t1b.length > 0, "Critical ticket overdue breaches");
const t3b = tBreaches.filter(b => b.ticket_id === "t3" && b.type === "resolved_late");
assert(t3b.length > 0, "Resolved late detected");

const slaInc = [
  { id: "i1", severity: "sev0", status: "investigating", opened_at: NOW - 2 * 3600000, closed_at: null, duration_m: null },
  { id: "i2", severity: "sev2", status: "closed", opened_at: NOW - 20 * 3600000, closed_at: NOW, duration_m: 1200 },
];
const iBreaches = detectIncidentSlaBreaches(slaInc);
assert(iBreaches.some(b => b.incident_id === "i1"), "Open sev0 overdue");
assert(iBreaches.some(b => b.incident_id === "i2"), "Closed sev2 took too long");

const summary = slaHealthSummary(slaTickets, slaInc);
assert(summary.total_breaches > 0, "SLA summary has breaches");
assert(summary.breach_rate >= 0, "Breach rate >= 0");

// ==================== Incident Impact ====================
console.log("\n=== Incident Impact Tests ===");

const impInc = { severity: "sev0", affected_accounts: 30, duration_m: 180, status: "investigating", opened_at: NOW - 3 * 3600000 };
const impact = scoreIncidentImpact(impInc, [], []);
assert(impact.score >= 50, "Sev0 incident gets high impact score");
assert(impact.level === "high" || impact.level === "critical", "High severity = high/critical level");
assert(impact.estimated_affected_mrr > 0, "Affected MRR estimated");

const sumImp = summarizeIncidentImpacts([impInc, { severity: "sev3", affected_accounts: 2, duration_m: 30, status: "closed", opened_at: NOW - 48 * 3600000 }]);
eq(sumImp.length, 2, "Two incidents summarized");
assert(sumImp[0].impact.score >= sumImp[1].impact.score, "Sev0 ranked above sev3");

// ==================== Deploy Risk ====================
console.log("\n=== Deploy Risk Tests ===");

const deploys = [
  { id: "d1", service: "api", version: "v3.1.0", environment: "production", status: "in_progress", started_at: NOW, risk_score: 5, rollback_ready: true },
  { id: "d2", service: "api", version: "v3.0.0", environment: "production", status: "completed", started_at: NOW - 3600000, risk_score: 3, rollback_ready: false },
];
const checks = { d1: [{ name: "lint", passed: true }, { name: "unit_tests", passed: false }], d2: [] };
const dr = scoreDeployRisk(deploys[0], deploys, checks);
assert(dr.score >= 1 && dr.score <= 10, "Risk score in 1-10 range");
assert(dr.factors.length > 0, "Risk factors present");
assert(dr.recommendation.length > 0, "Recommendation present");

const aggRisk = aggregateDeployRisk(deploys, checks);
assert(aggRisk.scored.length === 2, "Two deploys scored");
assert(aggRisk.avg_risk >= 1, "Avg risk >= 1");

// ==================== Experiment Decision ====================
console.log("\n=== Experiment Decision Tests ===");

const highExp = {
  id: "e1", name: "Test A", status: "running", variant_a_users: 2000, variant_b_users: 2000,
  metric: "conversion_rate", lift_pct: 5.5, confidence: 0.96, started_at: NOW - 30 * DAY,
};
const samples = [{ day: 1, lift_pct: 5.2 }, { day: 2, lift_pct: 5.4 }, { day: 3, lift_pct: 5.5 }, { day: 4, lift_pct: 5.6 }, { day: 5, lift_pct: 5.7 }];
const d1 = decideExperiment(highExp, samples);
eq(d1.decision, "ship", "Highly significant positive = ship");
assert(d1.is_highly_significant, "Is highly significant");
assert(d1.recommendation.ship, "Recommendation: ship");

const negExp = { ...highExp, lift_pct: -4.0, confidence: 0.97 };
const d2 = decideExperiment(negExp, samples.map(s => ({ ...s, lift_pct: -(s.lift_pct) })));
eq(d2.decision, "discard", "Significant negative = discard");

const lowExp = { ...highExp, lift_pct: 0.8, confidence: 0.85, variant_a_users: 200, variant_b_users: 200 };
const d3 = decideExperiment(lowExp, []);
eq(d3.decision, "continue", "Low confidence = continue");

const batch = batchDecide([highExp, negExp, lowExp], { e1: samples });
eq(batch.length, 3, "Batch decides 3 experiments");

// ==================== Filter State ====================
console.log("\n=== Filter State Tests ===");

const fs = new FilterState();
eq(fs.get("dateRange").from < fs.get("dateRange").to, true, "Date range from < to");

fs.set("selectedAccountId", "acct_0001");
eq(fs.get("selectedAccountId"), "acct_0001", "Account ID set/get");

fs.set("ticketStatuses", ["open", "in_progress"]);
eq(fs.get("ticketStatuses"), ["open", "in_progress"], "Ticket status filter set");

// Filter by date
const events = [
  { id: 1, ts: NOW - 10 * DAY },
  { id: 2, ts: NOW - 200 * DAY },
  { id: 3, ts: NOW - 1 * DAY },
];
const dateFiltered = fs.filterByDate(events, "ts");
assert(dateFiltered.length === 2, "Date filter excludes old events");
assert(dateFiltered.every(e => e.id !== 2), "Old event excluded");

// Sort
const items = [{ n: 3 }, { n: 1 }, { n: 2 }];
const asc = fs.sortBy(items, "n", "asc");
eq(asc[0].n, 1, "Sort ascending");
const desc = fs.sortBy(items, "n", "desc");
eq(desc[0].n, 3, "Sort descending");

// Filter tickets
const fTickets = [
  { status: "open", priority: "high" },
  { status: "resolved", priority: "normal" },
  { status: "open", priority: "low" },
];
fs.set("ticketStatuses", ["open"]);
fs.set("ticketPriorities", ["high", "low"]);
const fResult = fs.filterTickets(fTickets);
eq(fResult.length, 2, "Ticket filter: 2 matching");

// Saved views
fs.saveView("myview");
const views = fs.get("savedViews");
assert(views["myview"] != null, "View saved");

fs.set("selectedAccountId", "acct_0099");
const loaded = fs.loadView("myview");
assert(loaded, "View loaded");
eq(fs.get("selectedAccountId"), "acct_0001", "Load restored account ID");

fs.deleteView("myview");
eq(Object.keys(fs.get("savedViews")).length, 0, "View deleted");

// Sort settings
fs.setSort("tickets", "priority", "asc");
eq(fs.getSort("tickets"), { field: "priority", dir: "asc" }, "Sort stored per-section");

// ==================== Results ====================
console.log(`\n=== Results: ${passed}/${total} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
