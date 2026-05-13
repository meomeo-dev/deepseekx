// Billing fixtures — payment methods, attempts, credit memos, tax, gateway events.

const NOW = Date.now();
const DAY = 86400000;
const HOUR = 3600000;

let s = 723;
function nx() { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; }
function pick(arr) { return arr[Math.floor(nx() * arr.length)]; }
function intBetween(a, b) { return Math.floor(a + nx() * (b - a + 1)); }
function dateBetween(lo, hi) { return Math.floor(lo + nx() * (hi - lo)); }

// ---- Payment Methods ----
export function seedPaymentMethods(accounts) {
  const methods = {};
  const types = ["credit_card", "ach", "wire", "invoice_manual"];
  const cardBrands = ["visa", "mastercard", "amex"];
  for (const a of accounts) {
    if (a.health === "churned" && nx() > 0.5) continue;
    const method = {
      account_id: a.id,
      type: a.mrr > 5000 ? pick(["ach", "wire", "credit_card"]) : pick(["credit_card", "credit_card", "ach"]),
      is_primary: true,
      expiry_date: a.health !== "churned" ? NOW + intBetween(30, 365) * DAY : NOW - intBetween(1, 60) * DAY,
    };
    if (method.type === "credit_card") {
      method.card_brand = pick(cardBrands);
      method.last_four = String(intBetween(1000, 9999));
    }
    methods[a.id] = method;
  }
  return methods;
}

// ---- Payment Attempts ----
export function seedPaymentAttempts(accounts, invoices) {
  const attempts = [];
  const failureReasons = ["insufficient_funds", "card_expired", "bank_decline", "fraud_block", "gateway_timeout"];
  for (const a of accounts) {
    if (a.health === "churned") continue;
    const accountInvoices = invoices.filter(inv => inv.account_id === a.id && inv.status !== "paid");
    for (const inv of accountInvoices.slice(0, 3)) {
      const ts = inv.due_date + intBetween(0, 5) * DAY;
      if (ts > NOW) continue;
      const success = nx() > 0.25;
      attempts.push({
        id: `pay_${a.id}_${inv.id}`,
        account_id: a.id,
        invoice_id: inv.id,
        amount: inv.amount,
        status: success ? "succeeded" : "failed",
        failure_reason: success ? null : pick(failureReasons),
        gateway: pick(["stripe", "stripe", "adyen"]),
        timestamp: ts,
        retry_count: success ? 0 : intBetween(0, 3),
      });
    }
    // Extra failed attempts for higher-MRR overdue accounts
    const overdue = accountInvoices.filter(inv => inv.due_date < NOW - 30 * DAY);
    for (const inv of overdue.slice(0, 2)) {
      if (nx() > 0.4) continue;
      attempts.push({
        id: `pay_${a.id}_${inv.id}_retry`,
        account_id: a.id,
        invoice_id: inv.id,
        amount: inv.amount,
        status: "failed",
        failure_reason: pick(failureReasons),
        gateway: "stripe",
        timestamp: dateBetween(inv.due_date + 30 * DAY, NOW),
        retry_count: intBetween(1, 4),
      });
    }
  }
  return attempts.sort((a, b) => b.timestamp - a.timestamp);
}

// ---- Payment History (aggregate) ----
export function seedPaymentHistory(accounts, paymentAttempts) {
  const history = {};
  for (const a of accounts) {
    const acctAttempts = paymentAttempts.filter(pa => pa.account_id === a.id);
    const succeeded = acctAttempts.filter(pa => pa.status === "succeeded");
    const failed = acctAttempts.filter(pa => pa.status === "failed");
    history[a.id] = {
      total_invoices: acctAttempts.length,
      late_payments: failed.length,
      on_time_payments: succeeded.length,
      last_payment_date: succeeded.length > 0 ? Math.max(...succeeded.map(s => s.timestamp)) : null,
      billing_contact: nx() > 0.3,
    };
  }
  return history;
}

// ---- Credit Memos ----
export function seedCreditMemos(accounts, incidents) {
  const memos = [];
  const reasons = ["service_outage", "billing_error", "sla_breach", "goodwill", "customer_satisfaction"];
  for (const a of accounts.filter(a => a.health !== "churned" && nx() > 0.6)) {
    const amount = Math.round(a.mrr * pick([0.1, 0.25, 0.5, 0.05]));
    const linkedIncident = nx() > 0.5 ? pick(incidents.filter(i => i.status === "resolved" || i.status === "closed")) : null;
    memos.push({
      id: `cm_${a.id}_${memos.length}`,
      account_id: a.id,
      account_name: a.name,
      amount,
      reason_category: pick(reasons),
      reason_detail: pick(["Service disruption on May 3", "Duplicate invoice issued", "SLA target missed", "Courtesy credit", "Customer complaint resolution"]),
      linked_incident_id: linkedIncident ? linkedIncident.id : null,
      linked_ticket_id: null,
      status: pick(["pending", "approved", "approved", "applied"]),
      created_at: dateBetween(NOW - 60 * DAY, NOW),
      approved_by: null,
    });
  }
  return memos.sort((a, b) => b.created_at - a.created_at);
}

// ---- Tax Profiles ----
export function seedTaxProfiles(accounts) {
  const profiles = {};
  const countries = ["US", "US", "US", "GB", "DE", "CA", "AU"];
  for (const a of accounts) {
    if (a.health === "churned" && nx() > 0.7) continue;
    const country = pick(countries);
    profiles[a.id] = {
      account_id: a.id,
      country,
      tax_id: nx() > 0.2 ? `TAX-${String(intBetween(100000, 999999))}` : null,
      vat_registered: country !== "US" ? nx() > 0.5 : false,
      tax_exempt: nx() > 0.85,
      exempt_expiry: nx() > 0.85 ? NOW + intBetween(10, 180) * DAY : null,
      nexus_documentation: a.mrr > 7500 ? nx() > 0.5 : true,
      annual_filing: nx() > 0.6,
    };
  }
  return profiles;
}

// ---- Billing Contacts ----
export function seedBillingContacts(accounts) {
  const contacts = {};
  const names = ["Sarah Chen", "Marcus Webb", "Jordan Park", "Alex Rivera", "Taylor Kim", "Morgan Blake"];
  for (const a of accounts) {
    if (a.health === "churned") continue;
    if (nx() > 0.25) {
      contacts[a.id] = {
        name: pick(names),
        email: `billing@${a.name.toLowerCase().replace(/[^a-z]/g, "")}.com`,
        phone: nx() > 0.5 ? `+1-555-${String(intBetween(100, 999))}-${String(intBetween(1000, 9999))}` : null,
      };
    }
  }
  return contacts;
}

// ---- Gateway Events ----
export function seedGatewayEvents(paymentAttempts) {
  const events = [];
  const eventTypes = ["payment_intent_created", "charge_succeeded", "charge_failed", "refund_processed", "dispute_opened", "dispute_resolved"];
  for (const pa of paymentAttempts.slice(0, 30)) {
    events.push({
      id: `gw_${pa.id}`,
      payment_attempt_id: pa.id,
      type: pa.status === "succeeded" ? "charge_succeeded" : "charge_failed",
      gateway: pa.gateway,
      gateway_reference: `ch_${String(intBetween(1000000, 9999999))}`,
      timestamp: pa.timestamp + intBetween(1, 30) * 1000,
      raw_response: pa.status === "failed" ? `{"error": "${pa.failure_reason}", "decline_code": "${pa.failure_reason}"}` : '{"status": "succeeded"}',
    });
  }
  return events.sort((a, b) => b.timestamp - a.timestamp);
}

// ---- Entitlement Mismatches ----
export function seedEntitlementMismatches(accounts) {
  const mismatches = [];
  const features = ["advanced_reporting", "api_access", "sso", "audit_log", "custom_fields", "webhooks", "dedicated_support"];
  for (const a of accounts.filter(a => a.health !== "churned" && nx() > 0.5)) {
    mismatches.push({
      id: `ent_${a.id}`,
      account_id: a.id,
      account_name: a.name,
      feature: pick(features),
      status: pick(["active", "active", "resolved"]),
      estimated_monthly_value: Math.round(a.mrr * pick([0.05, 0.1, 0.15, 0.2])),
      detected_at: dateBetween(NOW - 90 * DAY, NOW),
    });
  }
  return mismatches.sort((a, b) => b.detected_at - a.detected_at);
}

// ---- Billing Incident Links ----
export function seedBillingIncidentLinks(incidents, accounts) {
  const links = [];
  for (const inc of incidents.filter(i => i.status === "resolved" || i.status === "closed")) {
    if (nx() > 0.6) continue;
    links.push({
      incident_id: inc.id,
      account_id: pick(accounts.filter(a => a.health !== "churned")).id,
      type: pick(["credit_issued", "refund_processed", "invoice_adjusted"]),
      amount: Math.round(intBetween(100, 5000)),
      created_at: inc.closed_at ? inc.closed_at + intBetween(1, 14) * DAY : inc.opened_at + intBetween(5, 30) * DAY,
    });
  }
  return links;
}

// Assemble
export function seedAllBillingFixtures(state, baseFixtures) {
  const paymentMethods = seedPaymentMethods(state.accounts);
  const paymentAttempts = seedPaymentAttempts(state.accounts, baseFixtures.invoices || []);
  const paymentHistory = seedPaymentHistory(state.accounts, paymentAttempts);
  const creditMemos = seedCreditMemos(state.accounts, state.incidents);
  const taxProfiles = seedTaxProfiles(state.accounts);
  const billingContacts = seedBillingContacts(state.accounts);
  const gatewayEvents = seedGatewayEvents(paymentAttempts);
  const entitlementMismatches = seedEntitlementMismatches(state.accounts);
  const billingIncidentLinks = seedBillingIncidentLinks(state.incidents, state.accounts);

  return {
    paymentMethods,
    paymentAttempts,
    paymentHistory,
    creditMemos,
    taxProfiles,
    billingContacts,
    gatewayEvents,
    entitlementMismatches,
    billingIncidentLinks,
  };
}
