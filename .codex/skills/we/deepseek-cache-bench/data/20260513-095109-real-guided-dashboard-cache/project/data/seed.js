// Northstar Ops Console — Seed data for a mid-market B2B subscription business.
// Values are realistic for a ~$12M ARR company with ~200 accounts.

const NOW_TS = Date.now();
const DAY_MS = 86400000;
const MONTH_MS = DAY_MS * 30;
const daysAgo = (d) => NOW_TS - d * DAY_MS;

const PLANS = [
  { name: "Starter",  mrr: 1200,  seats: 10,  features: ["core"] },
  { name: "Growth",   mrr: 3500,  seats: 30,  features: ["core","analytics","api"] },
  { name: "Business", mrr: 7500,  seats: 100, features: ["core","analytics","api","sso","audit"] },
  { name: "Enterprise", mrr: 18000, seats: 500, features: ["core","analytics","api","sso","audit","dedicated","sla"] },
];

const ACCOUNT_NAMES = [
  "Apex Manufacturing", "Beacon Health Partners", "Crestview Financial", "Delta Supply Chain",
  "Echelon Retail Group", "Frontier Logistics", "Granite Construction Co", "Harborview Medical",
  "Ironclad Security Solutions", "Junction Media Group", "Keystone Education", "Landmark Hospitality",
  "Meridian Insurance", "Northfield Agriculture", "Oakwood Legal Partners", "Pioneer Energy Services",
  "Quarry Mining Corp", "Ridgeline Property Mgmt", "Summit Consulting Group", "Thornwood Architects",
  "Union Transport Group", "Valley Telecom", "Westbrook Engineering", "York Capital Advisors",
  "Zenith Digital Agency", "Atlas Data Systems", "BlueSky Marketing", "Cornerstone Advisory",
  "Dune Analytics Partners", "Ember Creative Studio",
];

const HEALTH_STATES = ["healthy", "at_risk", "churned"];
const TICKET_PRIORITIES = ["low", "normal", "high", "critical"];
const TICKET_STATUSES = ["open", "in_progress", "pending_customer", "resolved"];
const INCIDENT_SEVERITIES = ["sev3", "sev2", "sev1", "sev0"];
const INCIDENT_STATUSES = ["investigating", "mitigating", "resolved", "closed"];
const DEPLOY_STATUSES = ["pending", "in_progress", "completed", "rolled_back"];
const DEPLOY_ENVIRONMENTS = ["staging", "canary", "production"];

// Deterministic seedable pseudo-random for reproducible data
let seed = 42;
function next() { seed = (seed * 16807 + 0) % 2147483647; return (seed - 1) / 2147483646; }
function pick(arr) { return arr[Math.floor(next() * arr.length)]; }
function range(n) { return Array.from({ length: n }, (_, i) => i); }
function intBetween(a, b) { return Math.floor(a + next() * (b - a + 1)); }
function floatBetween(a, b, d = 2) { return parseFloat((a + next() * (b - a)).toFixed(d)); }
function dateBetween(lo, hi) { return Math.floor(lo + next() * (hi - lo)); }

// ----- Accounts -----
export function seedAccounts() {
  return ACCOUNT_NAMES.map((name, i) => {
    const plan = PLANS[i % PLANS.length];
    const created = daysAgo(intBetween(60, 900));
    const health = i < 22 ? "healthy" : i < 28 ? "at_risk" : "churned";
    const churnedAt = health === "churned" ? dateBetween(created, NOW_TS) : null;
    return {
      id: `acct_${String(i + 1).padStart(4, "0")}`,
      name,
      plan: plan.name,
      mrr: plan.mrr,
      seats: plan.seats,
      health,
      created_at: created,
      churned_at: churnedAt,
      industry: pick(["Manufacturing","Healthcare","Finance","Logistics","Retail","Tech","Education","Hospitality","Energy","Legal"]),
      usage_pct: health === "healthy" ? intBetween(55, 98) : health === "at_risk" ? intBetween(8, 45) : 0,
    };
  });
}

// ----- Revenue Events -----
export function seedRevenue(accounts) {
  const events = [];
  for (const acct of accounts) {
    if (acct.health === "churned") continue;
    for (let m = 0; m < 12; m++) {
      const ts = daysAgo(m * 30 + intBetween(1, 28));
      events.push({
        id: `rev_${acct.id}_m${m}`,
        account_id: acct.id,
        account_name: acct.name,
        type: "charge",
        amount: acct.mrr,
        plan: acct.plan,
        timestamp: ts,
      });
      // Occasional upgrades / add-ons
      if (next() < 0.12) {
        events.push({
          id: `rev_${acct.id}_upg_m${m}`,
          account_id: acct.id,
          account_name: acct.name,
          type: "upgrade_addon",
          amount: floatBetween(200, 1200),
          plan: acct.plan,
          timestamp: ts + DAY_MS,
        });
      }
    }
    // Churned accounts get a final cancellation
    if (acct.churned_at) {
      events.push({
        id: `rev_${acct.id}_cancel`,
        account_id: acct.id,
        account_name: acct.name,
        type: "cancellation",
        amount: -acct.mrr,
        plan: acct.plan,
        timestamp: acct.churned_at,
      });
    }
  }
  return events.sort((a, b) => b.timestamp - a.timestamp);
}

// ----- Funnel -----
export function seedFunnel() {
  const stages = ["visitors", "signups", "trials_started", "activated", "qualified", "won"];
  const data = [];
  for (let w = 0; w < 12; w++) {
    const weekStart = daysAgo(w * 7);
    let v = intBetween(800, 2200);
    data.push({ week: w, timestamp: weekStart, stage: "visitors", count: v });
    data.push({ week: w, timestamp: weekStart, stage: "signups", count: Math.floor(v * floatBetween(0.18, 0.28)) });
    data.push({ week: w, timestamp: weekStart, stage: "trials_started", count: Math.floor(v * floatBetween(0.10, 0.16)) });
    data.push({ week: w, timestamp: weekStart, stage: "activated", count: Math.floor(v * floatBetween(0.04, 0.08)) });
    data.push({ week: w, timestamp: weekStart, stage: "qualified", count: Math.floor(v * floatBetween(0.015, 0.035)) });
    data.push({ week: w, timestamp: weekStart, stage: "won", count: Math.floor(v * floatBetween(0.006, 0.014)) });
  }
  return data;
}

// ----- Support Tickets -----
export function seedTickets(accounts) {
  const titles = [
    "Unable to export report to CSV", "SSO login fails for new users",
    "Billing invoice incorrect for last month", "Dashboard widget not loading",
    "API rate limit exceeded during batch import", "User permissions not updating after role change",
    "Email notifications delayed by 2 hours", "Data sync failing for Salesforce integration",
    "Custom field validation error on save", "Audit log missing entries for last week",
    "Webhook delivery failing with 500", "Mobile view broken on iOS Safari",
    "PDF generation times out for large datasets", "Two-factor auth code not received",
    "Bulk delete action reverts after page refresh",
  ];
  const tickets = [];
  for (let i = 0; i < 60; i++) {
    const acct = pick(accounts);
    const created = dateBetween(daysAgo(90), NOW_TS);
    const status = pick(TICKET_STATUSES);
    const resolved = status === "resolved" ? created + intBetween(1, 72) * 3600000 : null;
    tickets.push({
      id: `ticket_${String(i + 1).padStart(4, "0")}`,
      account_id: acct.id,
      account_name: acct.name,
      title: pick(titles),
      priority: pick(TICKET_PRIORITIES),
      status,
      assignee: pick(["alex.chen","jordan.kim","taylor.reed","morgan.smith",null]),
      created_at: created,
      resolved_at: resolved,
      satisfaction_score: resolved ? intBetween(1, 5) : null,
    });
  }
  return tickets.sort((a, b) => b.created_at - a.created_at);
}

// ----- Incidents -----
export function seedIncidents() {
  const titles = [
    "API latency spike in us-east-1", "Database connection pool exhaustion",
    "SSO certificate expiry warning", "Cache invalidation delay affecting dashboard",
    "Webhook delivery degraded for EU region", "Memory leak in report generation worker",
    "CDN partial outage in APAC", "Rate limiter misconfiguration allowing bursts",
    "TLS handshake failures on payment gateway", "Background job queue backlog exceeding threshold",
  ];
  const incidents = [];
  for (let i = 0; i < 18; i++) {
    const opened = dateBetween(daysAgo(90), NOW_TS);
    const status = pick(INCIDENT_STATUSES);
    const closed = status === "closed" || status === "resolved" ? opened + intBetween(1, 48) * 3600000 : null;
    incidents.push({
      id: `inc_${String(i + 1).padStart(4, "0")}`,
      title: pick(titles),
      severity: pick(INCIDENT_SEVERITIES),
      status,
      opened_at: opened,
      closed_at: closed,
      duration_m: closed ? Math.round((closed - opened) / 60000) : null,
      affected_accounts: intBetween(2, 45),
    });
  }
  return incidents.sort((a, b) => b.opened_at - a.opened_at);
}

// ----- Experiments -----
export function seedExperiments() {
  const names = [
    "New onboarding wizard vs. classic flow", "Redesigned pricing page layout",
    "In-app NPS survey placement", "Trial extension offer messaging",
    "Dark mode default for new users", "Simplified checkout flow",
  ];
  const experiments = [];
  const statuses = ["running", "running", "concluded", "concluded", "draft"];
  for (let i = 0; i < names.length; i++) {
    const started = daysAgo(intBetween(10, 60));
    experiments.push({
      id: `exp_${String(i + 1).padStart(3, "0")}`,
      name: names[i],
      status: statuses[i],
      variant_a_users: intBetween(800, 3500),
      variant_b_users: intBetween(800, 3500),
      metric: pick(["conversion_rate","activation_rate","revenue_per_user","retention_d7"]),
      lift_pct: floatBetween(-3, 12),
      confidence: floatBetween(0.75, 0.99),
      started_at: started,
    });
  }
  return experiments;
}

// ----- Deployments -----
export function seedDeployments() {
  const services = ["api-gateway", "billing-worker", "web-app", "auth-service", "reporting-engine", "notification-service"];
  const deployments = [];
  for (let i = 0; i < 22; i++) {
    const started = dateBetween(daysAgo(30), NOW_TS);
    const status = pick(DEPLOY_STATUSES);
    deployments.push({
      id: `deploy_${String(i + 1).padStart(4, "0")}`,
      service: pick(services),
      version: `v${intBetween(2,5)}.${intBetween(0,20)}.${intBetween(0,99)}`,
      environment: pick(DEPLOY_ENVIRONMENTS),
      status,
      started_at: started,
      completed_at: status === "completed" ? started + intBetween(2, 25) * 60000 : null,
      author: pick(["dana.zhou","lee.patel","sam.owens","noah.garcia"]),
      risk_score: intBetween(1, 10),
      rollback_ready: next() > 0.6,
    });
  }
  return deployments.sort((a, b) => b.started_at - a.started_at);
}

// ----- Retention Cohorts -----
export function seedRetention() {
  const cohorts = [];
  const sizes = [48, 52, 44, 39, 41, 35, 38, 42, 33, 37, 45, 40];
  for (let m = 0; m < 12; m++) {
    const label = `2025-${String((m % 12) + 1).padStart(2, "0")}`;
    const base = sizes[m];
    const retention = [1.0];
    let remaining = base;
    for (let period = 1; period <= Math.min(12, 11 - m); period++) {
      const churnRate = 0.02 + (period * 0.005) + (next() * 0.03);
      remaining = Math.max(0, remaining * (1 - churnRate));
      retention.push(parseFloat((remaining / base).toFixed(4)));
    }
    cohorts.push({ label, size: base, retention });
  }
  return cohorts;
}

// Assemble everything
export function seedAll() {
  const accounts = seedAccounts();
  return {
    accounts,
    revenue_events: seedRevenue(accounts),
    funnel: seedFunnel(),
    retention_cohorts: seedRetention(),
    tickets: seedTickets(accounts),
    incidents: seedIncidents(),
    experiments: seedExperiments(),
    deployments: seedDeployments(),
  };
}
