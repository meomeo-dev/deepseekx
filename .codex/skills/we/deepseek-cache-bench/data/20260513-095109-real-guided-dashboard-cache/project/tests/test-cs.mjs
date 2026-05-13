// Northstar Ops Console — CS Portfolio & Renewals tests.
import { segmentAccounts, segmentSummary } from "../scripts/portfolio/segmentation.js";
import { recommendActions, batchRecommend, actionSummary } from "../scripts/portfolio/next-action.js";
import { scoreExpansionOpportunity, topExpansionOpportunities, expansionSummary } from "../scripts/portfolio/expansion-scoring.js";
import { generateRenewalCalendar, calendarSummary, interventionQueue, probabilityBands } from "../scripts/renewals/calendar.js";
import { computeOwnerWorkload, workloadSummary } from "../scripts/renewals/owner-workload.js";
import { matchPlaybooks, batchMatch, playbookSummary } from "../scripts/renewals/playbook-matching.js";

const NOW = Date.now();
const DAY = 86400000;
let passed = 0, failed = 0, total = 0;

function assert(condition, label) { total++; if (condition) passed++; else { failed++; console.error(`  FAIL: ${label}`); } }
function eq(actual, expected, label) { total++; const a = JSON.stringify(actual), e = JSON.stringify(expected); if (a === e) passed++; else { failed++; console.error(`  FAIL: ${label} — expected ${e}, got ${a}`); } }

// ---- Test Accounts & Fixtures ----
const accounts = [
  { id: "a1", name: "Alpha Corp", plan: "Enterprise", mrr: 18000, health: "healthy", industry: "Finance", usage_pct: 92, seats: 400, feature_adoption: 0.8 },
  { id: "a2", name: "Beta LLC", plan: "Growth", mrr: 3500, health: "at_risk", industry: "Tech", usage_pct: 15, seats: 30, feature_adoption: 0.2 },
  { id: "a3", name: "Gamma Inc", plan: "Starter", mrr: 1200, health: "healthy", industry: "Retail", usage_pct: 65, seats: 10, feature_adoption: 0.5 },
  { id: "a4", name: "Delta Co", plan: "Business", mrr: 7500, health: "churned", industry: "Manufacturing", usage_pct: 0, seats: 100, feature_adoption: 0 },
];
const contracts = {
  a1: { account_id: "a1", start_date: NOW - 400 * DAY, renewal_date: NOW + 80 * DAY, term_months: 12, auto_renew: true, discount_pct: 5, success_plan_pct: 0.85, cs_owner: "emma.wu" },
  a2: { account_id: "a2", start_date: NOW - 200 * DAY, renewal_date: NOW + 25 * DAY, term_months: 12, auto_renew: false, discount_pct: 0, success_plan_pct: 0.25, cs_owner: "raj.patel" },
  a3: { account_id: "a3", start_date: NOW - 100 * DAY, renewal_date: NOW + 200 * DAY, term_months: 12, auto_renew: true, discount_pct: 0, success_plan_pct: 0.60, cs_owner: "lisa.chen" },
  a4: { account_id: "a4", start_date: NOW - 500 * DAY, renewal_date: NOW - 30 * DAY, term_months: 12, auto_renew: false, discount_pct: 10, success_plan_pct: 0.10, cs_owner: null },
};

// ==================== Segmentation ====================
console.log("\n=== Segmentation Tests ===");

const segments = segmentAccounts(accounts, { contracts });
eq(segments.by_health.healthy.length, 2, "2 healthy accounts");
eq(segments.by_health.at_risk.length, 1, "1 at-risk account");
eq(segments.by_health.churned.length, 1, "1 churned account");
eq(Object.keys(segments.by_csm).length, 4, "4 CSM groups (incl unassigned)");
eq(segments.by_csm["emma.wu"].length, 1, "Emma Wu has 1 account");
eq(segments.by_csm["unassigned"].length, 1, "Delta has no CSM");
eq(segments.by_renewal_urgency.imminent.length, 1, "1 imminent renewal (<=30d)");
eq(segments.by_renewal_urgency.this_quarter.length, 1, "1 this-quarter renewal");

const sum = segmentSummary(segments);
eq(sum.total, 4, "Total 4 accounts");
eq(sum.healthy, 2, "2 healthy");
eq(sum.renewal_imminent, 1, "1 imminent (churned excluded)");

// ==================== Next Action ====================
console.log("\n=== Next Action Tests ===");

const ctxAlpha = {
  healthScore: 85, engagementScore: 72, expansionScore: 68,
  daysUntilRenewal: 80, openCriticalTickets: 0, avgCsat: 4.5,
  successPlanPct: 0.85, featureAdoptionRate: 0.8, hasStakeholders: true,
  healthTrend: "stable", renewalProbability: 0.92, health: "healthy", mrr: 18000,
};
const ctxBeta = {
  healthScore: 35, engagementScore: 18, expansionScore: 5,
  daysUntilRenewal: 25, openCriticalTickets: 2, avgCsat: 1.8,
  successPlanPct: 0.25, featureAdoptionRate: 0.2, hasStakeholders: false,
  healthTrend: "declining", renewalProbability: 0.45, health: "at_risk", mrr: 3500,
};

const alphaActions = recommendActions(accounts[0], ctxAlpha);
assert(alphaActions.length > 0, "Alpha Corp gets actions");
assert(alphaActions.some(a => a.action_id === "expansion_discussion"), "Alpha gets expansion discussion");

const betaActions = recommendActions(accounts[1], ctxBeta);
assert(betaActions.length > 0, "Beta gets actions");
assert(betaActions.some(a => a.priority === "critical" || a.priority === "high"), "Beta has high/urgent action");
assert(betaActions.some(a => a.action_id === "urgent_retention"), "Beta needs urgent retention");

const batch = batchRecommend(accounts, a => a.id === "a1" ? ctxAlpha : a.id === "a2" ? ctxBeta : ctxAlpha);
eq(Object.keys(batch).length, 4, "Batch covers 4 accounts");

const actSum = actionSummary(batch);
assert(actSum.totalAccounts === 4, "Action summary covers 4 accounts");

// ==================== Expansion Scoring ====================
console.log("\n=== Expansion Scoring Tests ===");

const fixtures = {
  featureAdoption: {
    a1: { rate: 0.8, total_features_available: 8, adopted: 6, top_features: ["dashboard","reporting"], unused_features: ["webhooks","automations"] },
    a2: { rate: 0.2, total_features_available: 4, adopted: 1, top_features: ["dashboard"], unused_features: ["reporting","api_access","sso"] },
  },
  usageEvents: [
    { account_id: "a1", timestamp: NOW - 5 * DAY, value: 90 },
    { account_id: "a1", timestamp: NOW - 10 * DAY, value: 88 },
    { account_id: "a2", timestamp: NOW - 5 * DAY, value: 12 },
  ],
  expansionSignals: [
    { account_id: "a1", type: "seat_growth_request", timestamp: NOW - 10 * DAY },
    { account_id: "a1", type: "feature_inquiry", timestamp: NOW - 20 * DAY },
  ],
  contracts,
};

const a1Exp = scoreExpansionOpportunity(accounts[0], fixtures);
assert(a1Exp.score >= 50, "Alpha Corp has strong expansion score");
assert(a1Exp.level === "strong" || a1Exp.level === "moderate", "Alpha has expansion potential");

const a2Exp = scoreExpansionOpportunity(accounts[1], fixtures);
assert(a2Exp.score < 30, "Beta has low expansion score (at-risk)");

const top = topExpansionOpportunities(accounts.filter(a => a.health !== "churned"), fixtures, 3);
assert(top.length <= 3, "Top expansion limited to 3");
assert(top[0].account.id === "a1", "Alpha is top expansion target");

const expSum = expansionSummary(top);
assert(expSum.strongCount + expSum.byLevel.moderate >= 1, "At least 1 expansion opportunity");

// ==================== Renewal Calendar ====================
console.log("\n=== Renewal Calendar Tests ===");

const cal = generateRenewalCalendar(accounts, contracts, 120);
assert(cal.length >= 2, "Calendar has >=2 entries (a4 renewal is in past, excluded)");
assert(cal[0].days_until_renewal <= cal[1].days_until_renewal, "Calendar sorted by days ascending");

const probMap = { a1: 0.92, a2: 0.45, a3: 0.88 };
const cs = calendarSummary(cal, probMap);
assert(cs.total_upcoming >= 2, "Total upcoming >= 2");
assert(cs.next_30_days.count >= 1, "Has renewals in next 30 days");
assert(cs.at_risk_count >= 0, "At-risk count present");
assert(cs.next_30_days.expected_arr <= cs.next_30_days.mrr * 12, "Expected ARR <= current ARR");

// Intervention queue
const iq = interventionQueue(cal, { a1: { score: 85 }, a2: { score: 35 } }, {}, probMap);
assert(iq.some(q => q.account_id === "a2"), "Beta is in intervention queue");
assert(iq[0].risk_reason.length > 0, "Risk reason present");

// Probability bands
const pb = probabilityBands(cal, probMap);
assert(pb.high_count + pb.medium_count + pb.low_count + pb.bands.unknown.length === cal.length, "All accounts binned");

// ==================== Owner Workload ====================
console.log("\n=== Owner Workload Tests ===");

const ownerCapacity = {
  "emma.wu": { max_accounts: 3, max_renewals_per_month: 2 },
  "raj.patel": { max_accounts: 3, max_renewals_per_month: 2 },
};
const meetings = [
  { owner: "emma.wu", type: "qbr", scheduled: NOW + 10 * DAY },
  { owner: "emma.wu", type: "check_in", scheduled: NOW + 15 * DAY },
];

const wl = computeOwnerWorkload(cal, ownerCapacity, meetings);
const wlKeys = Object.keys(wl);
assert(wlKeys.length >= 2, "Workload has 2+ owners");
assert(wl["emma.wu"].accounts.length >= 1, "Emma Wu has accounts");
assert(wl["emma.wu"].meetings >= 2, "Emma Wu has 2 meetings");
assert(wl["emma.wu"].qbrs >= 1, "Emma Wu has 1 QBR");

const wlSum = workloadSummary(wl);
assert(wlSum.total_owners >= 2, "2+ owners in summary");
assert(wlSum.by_owner.length >= 2, "Owner list present");

// ==================== Playbook Matching ====================
console.log("\n=== Playbook Matching Tests ===");

const ctxForPlaybook = {
  healthScore: 35, engagementScore: 20, expansionScore: 5,
  daysUntilRenewal: 20, renewalProbability: 0.4, mrr: 3500,
  successPlanPct: 0.2, featureAdoptionRate: 0.2,
  avgCsat: 2.0, hasStakeholders: true, hasUpcomingQbr: false,
  health: "at_risk",
};

const plays = matchPlaybooks({ id: "a2", name: "Beta LLC" }, ctxForPlaybook);
assert(plays.length > 0, "Beta gets playbooks");
assert(plays.some(p => p.category === "retention"), "At-risk account gets retention playbook");
assert(plays.length <= 3, "Max 3 playbooks returned");

const batchPlays = batchMatch(accounts, a => ctxForPlaybook);
eq(Object.keys(batchPlays).length, 4, "Batch matches 4 accounts");

const playSum = playbookSummary(batchPlays);
assert(playSum.total_matches > 0, "Playbook summary has matches");
assert(playSum.byPlay.length > 0, "Play list non-empty");

// ==================== Results ====================
console.log(`\n=== Results: ${passed}/${total} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
