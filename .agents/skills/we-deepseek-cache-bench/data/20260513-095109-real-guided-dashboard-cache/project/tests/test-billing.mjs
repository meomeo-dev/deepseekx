// Billing Ops — domain module tests.
import { ageInvoices, agingSummary, atRiskAccounts } from "../scripts/billing/invoice-aging.js";
import { prioritizeDunning, dunningSummary } from "../scripts/billing/dunning-prioritization.js";
import { analyzeFailedPayments, failedPaymentSummary } from "../scripts/billing/failed-payment-routing.js";
import { detectLeakage, leakageSummary } from "../scripts/billing/revenue-leakage.js";
import { evaluateCreditMemo, batchEvaluate, creditMemoSummary } from "../scripts/billing/credit-memo-rules.js";
import { scoreTaxRisk, batchScoreTaxRisks, taxRiskSummary } from "../scripts/billing/tax-risk-scoring.js";
import { correlateIncidentsToBilling, billingIncidentSummary } from "../scripts/billing/incident-billing-correlation.js";
import { forecastCollections, collectionForecastSummary } from "../scripts/billing/cash-collection-forecast.js";

const NOW = Date.now();
const DAY = 86400000;
let passed = 0, failed = 0, total = 0;
function assert(condition, label) { total++; if (condition) passed++; else { failed++; console.error(`  FAIL: ${label}`); } }
function eq(actual, expected, label) { total++; const a = JSON.stringify(actual), e = JSON.stringify(expected); if (a === e) passed++; else { failed++; console.error(`  FAIL: ${label} — expected ${e}, got ${a}`); } }

const invoices = [
  { id: "inv1", account_id: "a1", account_name: "Alpha", amount: 5000, due_date: NOW + 10 * DAY, status: "pending", paid_date: null },
  { id: "inv2", account_id: "a1", account_name: "Alpha", amount: 5000, due_date: NOW - 45 * DAY, status: "overdue", paid_date: null },
  { id: "inv3", account_id: "a2", account_name: "Beta", amount: 3500, due_date: NOW - 100 * DAY, status: "overdue", paid_date: null },
  { id: "inv4", account_id: "a3", account_name: "Gamma", amount: 1200, due_date: NOW - 60 * DAY, status: "paid", paid_date: NOW - 55 * DAY },
];
const accounts = [
  { id: "a1", name: "Alpha Corp", mrr: 18000, health: "healthy", plan: "Enterprise" },
  { id: "a2", name: "Beta LLC", mrr: 3500, health: "at_risk", plan: "Growth" },
  { id: "a3", name: "Gamma Inc", mrr: 1200, health: "healthy", plan: "Starter" },
];

// ==================== Invoice Aging ====================
console.log("\n=== Invoice Aging Tests ===");
const buckets = ageInvoices(invoices);
eq(buckets.current.length, 1, "1 current invoice");
eq(buckets.aging_31_60.length, 1, "1 in 31-60 day bucket");
eq(buckets.aging_90_plus.length, 1, "1 in 90+ day bucket");
eq(buckets.paid.length, 1, "1 paid invoice");

const aging = agingSummary(buckets);
assert(aging.total_outstanding > 0, "Total outstanding > 0");
assert(aging.total_overdue > 0, "Total overdue > 0");
eq(aging.aging_90_plus.count, 1, "1 invoice 90+ days overdue");

const atRisk = atRiskAccounts(buckets);
assert(atRisk.length >= 1, "At least 1 at-risk account");
assert(atRisk[0].total > 0, "At-risk total > 0");

// ==================== Dunning Prioritization ====================
console.log("\n=== Dunning Prioritization Tests ===");
const paymentHistory = {
  a1: { total_invoices: 12, late_payments: 1, on_time_payments: 11, last_payment_date: NOW - 20 * DAY, billing_contact: true },
  a2: { total_invoices: 8, late_payments: 5, on_time_payments: 3, last_payment_date: NOW - 80 * DAY, billing_contact: false },
};
const billingContacts = { a1: { name: "Sarah Chen", email: "sarah@alpha.com" } };

const dunningQueue = prioritizeDunning(atRisk, accounts, paymentHistory, billingContacts);
assert(dunningQueue.length > 0, "Dunning queue has entries");
const topDun = dunningQueue[0];
assert(topDun.score > 0, "Top dunning item has score");
assert(topDun.tier.length > 0, "Tier assigned");

const dunSum = dunningSummary(dunningQueue);
assert(dunSum.total_in_dunning > 0, "Dunning summary has count");
assert(dunSum.total_amount_due > 0, "Dunning total amount > 0");

// ==================== Failed Payment Routing ====================
console.log("\n=== Failed Payment Routing Tests ===");
const paymentAttempts = [
  { id: "pa1", account_id: "a1", invoice_id: "inv2", amount: 5000, status: "failed", failure_reason: "card_expired", gateway: "stripe", timestamp: NOW - 10 * DAY, retry_count: 2 },
  { id: "pa2", account_id: "a2", invoice_id: "inv3", amount: 3500, status: "failed", failure_reason: "insufficient_funds", gateway: "stripe", timestamp: NOW - 5 * DAY, retry_count: 1 },
];

const fpRouted = analyzeFailedPayments(paymentAttempts, invoices, accounts);
assert(fpRouted.length >= 1, "Failed payments routed");
const firstFp = fpRouted[0];
assert(firstFp.route.length > 0, "Route assigned");
assert(firstFp.primary_reason.length > 0, "Reason captured");

const fpSum = failedPaymentSummary(fpRouted);
assert(fpSum.total_accounts > 0, "FP summary has accounts");

// ==================== Revenue Leakage ====================
console.log("\n=== Revenue Leakage Tests ===");
const contracts = {
  a1: { start_date: NOW - 500 * DAY, term_months: 12, discount_pct: 15, auto_renew: true },
};
const mismatches = [
  { id: "m1", account_id: "a1", feature: "advanced_reporting", status: "active", estimated_monthly_value: 2000 },
];

const leaks = detectLeakage(accounts, invoices, contracts, mismatches);
const leakForA1 = leaks.find(l => l.account_id === "a1");
assert(leakForA1 != null, "Leakage detected for a1");
assert(leakForA1.items.some(i => i.type === "entitlement_gap"), "Entitlement gap flagged");
assert(leakForA1.items.some(i => i.type === "discount_legacy"), "Discount legacy flagged");

const leakSum = leakageSummary(leaks);
assert(leakSum.total_accounts_with_leaks > 0, "Leakage summary has accounts");
assert(leakSum.total_annual_leakage > 0, "Annual leakage > 0");

// ==================== Credit Memo Rules ====================
console.log("\n=== Credit Memo Rules Tests ===");
const creditRequest = {
  id: "cm1", account_id: "a1", amount: 3000,
  reason_category: "service_outage",
  linked_incident_id: "inc_0001",
};
const ev = evaluateCreditMemo(creditRequest, accounts[0], invoices, paymentHistory);
assert(ev.decision !== "deny", "Service outage credit not denied");
assert(ev.approval_score > 30, "Has reasonable approval score");

const batchEval = batchEvaluate([creditRequest], accounts, invoices, paymentHistory);
eq(batchEval.length, 1, "Batch evaluates 1 request");
const cmSum = creditMemoSummary(batchEval);
eq(cmSum.total_requests, 1, "CM summary has 1 request");

// ==================== Tax Risk ====================
console.log("\n=== Tax Risk Tests ===");
const taxProfile = { country: "DE", tax_id: "DE123456", vat_registered: true };
const taxResult = scoreTaxRisk(accounts[0], taxProfile, {});
eq(taxResult.risk_level, "low", "Properly registered DE account = low risk");

const missingTaxProfile = scoreTaxRisk(accounts[1], null, {});
eq(missingTaxProfile.risk_level, "unknown", "Missing tax profile = unknown risk");

const scored = batchScoreTaxRisks(accounts, { a1: taxProfile }, {});
assert(scored.length >= 2, "Batch scores non-churned accounts");
const tSum = taxRiskSummary(scored);
assert(tSum.total >= 2, "Tax summary covers accounts");

// ==================== Billing-Incident Correlation ====================
console.log("\n=== Billing-Incident Correlation Tests ===");
const incidents = [
  { id: "inc_0001", title: "API outage", severity: "sev1", opened_at: NOW - 30 * DAY, closed_at: NOW - 25 * DAY, affected_accounts: 5 },
];
const creditMemos = [
  { id: "cm1", account_id: "a1", account_name: "Alpha", amount: 3000, created_at: NOW - 28 * DAY },
];
const impactMap = { inc_0001: ["a1"] };

const corr = correlateIncidentsToBilling(incidents, creditMemos, [], impactMap);
assert(corr.length > 0, "Correlation found");
eq(corr[0].total_credit_amount, 3000, "Credit amount correct");

const bicSum = billingIncidentSummary(corr);
eq(bicSum.total_correlated, 1, "1 correlated incident");

// ==================== Cash Collection Forecast ====================
console.log("\n=== Cash Collection Forecast Tests ===");
const forecast = forecastCollections(atRisk, accounts, paymentHistory);
assert(forecast.total_outstanding > 0, "Forecast has outstanding");
assert(forecast.expected_recovery_pct > 0, "Recovery rate > 0");

const cfSum = collectionForecastSummary(forecast);
assert(cfSum.total_outstanding > 0, "CF summary has total");

console.log(`\n=== Results: ${passed}/${total} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
