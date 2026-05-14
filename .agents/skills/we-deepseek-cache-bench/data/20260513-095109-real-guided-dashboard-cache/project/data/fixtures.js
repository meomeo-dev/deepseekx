// Northstar Ops Console — Extended fixtures for domain depth.
// Reuses the same RNG pattern from seed.js for reproducibility.

const NOW_TS = Date.now();
const DAY = 86400000;

let seed = 137;
function nx() { seed = (seed * 16807 + 0) % 2147483647; return (seed - 1) / 2147483646; }
function pick(arr) { return arr[Math.floor(nx() * arr.length)]; }
function intBetween(a, b) { return Math.floor(a + nx() * (b - a + 1)); }
function dateBetween(lo, hi) { return Math.floor(lo + nx() * (hi - lo)); }

// ---- Account Segments ----
export function seedSegments(accounts) {
  const segments = [
    { id: "seg_ent", name: "Enterprise", criteria: a => a.mrr >= 7500 },
    { id: "seg_mid", name: "Mid-Market", criteria: a => a.mrr >= 3000 && a.mrr < 7500 },
    { id: "seg_smb", name: "SMB", criteria: a => a.mrr < 3000 },
  ];
  const byAccount = {};
  for (const a of accounts) {
    for (const seg of segments) {
      if (seg.criteria(a)) { byAccount[a.id] = seg.id; break; }
    }
  }
  return { segments, byAccount };
}

// ---- Contracts ----
export function seedContracts(accounts) {
  const contracts = {};
  for (const a of accounts) {
    const start = a.created_at;
    const termMonths = pick([12, 12, 12, 24, 36]);
    const renewal = start + termMonths * 30 * DAY;
    contracts[a.id] = {
      account_id: a.id,
      start_date: start,
      renewal_date: renewal,
      term_months: termMonths,
      auto_renew: nx() > 0.3,
      discount_pct: pick([0, 0, 0, 5, 10, 15]),
      success_plan_pct: a.health === "healthy" ? intBetween(50, 100) / 100 : a.health === "at_risk" ? intBetween(10, 60) / 100 : 0,
      cs_owner: pick(["emma.wu", "raj.patel", "lisa.chen", "omar.jones", null]),
    };
  }
  return contracts;
}

// ---- Invoices ----
export function seedInvoices(accounts) {
  const invoices = [];
  for (const a of accounts) {
    if (a.health === "churned") continue;
    for (let m = 0; m < 12; m++) {
      const due = a.created_at + (m + 1) * 30 * DAY;
      const paid = due + intBetween(-2, 10) * DAY;
      invoices.push({
        id: `inv_${a.id}_${m}`,
        account_id: a.id,
        account_name: a.name,
        amount: a.mrr,
        due_date: due,
        paid_date: paid <= NOW_TS ? paid : null,
        status: paid <= NOW_TS ? "paid" : due + 15 * DAY < NOW_TS ? "overdue" : "pending",
        invoice_number: `INV-${String(intBetween(1000, 9999))}`,
      });
    }
  }
  return invoices.sort((a, b) => b.due_date - a.due_date);
}

// ---- Usage Events (daily for 90 days) ----
export function seedUsageEvents(accounts) {
  const events = [];
  for (const a of accounts) {
    const baseUsage = a.usage_pct || 30;
    for (let d = 0; d < 90; d++) {
      const ts = NOW_TS - d * DAY;
      const noise = (nx() - 0.5) * 20;
      let trend = 0;
      if (a.health === "at_risk") trend = -d * 0.3;
      else if (a.health === "churned" && d > 60) trend = -50;
      const value = Math.max(0, Math.min(100, baseUsage + noise + trend));
      events.push({
        account_id: a.id,
        timestamp: ts,
        value: parseFloat(value.toFixed(1)),
        event_type: pick(["login", "login", "login", "feature_use", "export", "api_call"]),
      });
    }
  }
  return events.sort((a, b) => b.timestamp - a.timestamp);
}

// ---- NPS Responses ----
export function seedNps(accounts) {
  const responses = [];
  const verbatims = [
    "Great platform, very reliable.", "Support team is responsive.",
    "Wish the reporting was faster.", "API docs need more examples.",
    "Best tool in our stack.", "Onboarding was smooth.",
    "Missing some enterprise features.", "Pricing feels high for our scale.",
    "Excellent uptime.", "Would recommend to peers.",
  ];
  for (const a of accounts) {
    if (a.health === "churned" && nx() > 0.5) continue;
    const count = intBetween(0, 3);
    for (let i = 0; i < count; i++) {
      const score = a.health === "healthy" ? intBetween(7, 10) : a.health === "at_risk" ? intBetween(3, 7) : intBetween(1, 5);
      responses.push({
        account_id: a.id,
        account_name: a.name,
        score,
        category: score >= 9 ? "promoter" : score >= 7 ? "passive" : "detractor",
        verbatim: pick(verbatims),
        timestamp: dateBetween(NOW_TS - 180 * DAY, NOW_TS),
      });
    }
  }
  return responses.sort((a, b) => b.timestamp - a.timestamp);
}

// ---- Success Plans ----
export function seedSuccessPlans(accounts, contracts) {
  const plans = [];
  const milestones = [
    "Complete onboarding", "First value milestone", "Integrate with CRM",
    "Train admin users", "Launch to end users", "QBR meeting",
    "Health check call", "Feature adoption review", "Renewal discussion",
    "Case study interview",
  ];
  for (const a of accounts) {
    if (a.health === "churned") continue;
    const contract = contracts[a.id];
    const planMilestones = milestones.slice(0, intBetween(3, 6)).map((name, i) => ({
      name,
      completed: i < Math.floor((contract?.success_plan_pct || 0.3) * milestones.length),
      due_date: a.created_at + (i + 1) * 60 * DAY,
    }));
    plans.push({
      account_id: a.id,
      account_name: a.name,
      milestones: planMilestones,
      completed: planMilestones.filter(m => m.completed).length,
      total: planMilestones.length,
      pct: planMilestones.length > 0
        ? planMilestones.filter(m => m.completed).length / planMilestones.length
        : 0,
    });
  }
  return plans;
}

// ---- Feature Adoption ----
export function seedFeatureAdoption(accounts) {
  const features = ["dashboard", "reporting", "api_access", "sso", "audit_log", "webhooks", "automations", "custom_fields"];
  const adoption = {};
  for (const a of accounts) {
    const planFeatures = { Starter: 2, Growth: 4, Business: 6, Enterprise: 8 };
    const maxF = planFeatures[a.plan] || 4;
    const adopted = a.health === "healthy" ? intBetween(Math.ceil(maxF * 0.5), maxF)
                   : a.health === "at_risk" ? intBetween(1, Math.floor(maxF * 0.4))
                   : 0;
    adoption[a.id] = {
      total_features_available: maxF,
      adopted: Math.min(adopted, maxF),
      rate: maxF > 0 ? adopted / maxF : 0,
      top_features: features.slice(0, adopted),
      unused_features: features.slice(adopted, maxF),
    };
  }
  return adoption;
}

// ---- Ticket Comments ----
export function seedTicketComments(tickets) {
  const comments = [];
  const agents = ["alex.chen", "jordan.kim", "taylor.reed", "morgan.smith"];
  const templates = [
    "Looking into this now.",
    "Can you provide the error message you're seeing?",
    "I've identified the root cause. Working on a fix.",
    "This is related to the recent deploy. Rolling back.",
    "Could you try clearing your cache and retrying?",
    "Escalating to engineering team.",
    "Fix deployed. Please verify on your end.",
    "Marking as resolved. Reopen if the issue persists.",
    "We need more details to reproduce this.",
    "This is a known issue. Tracking in INC-{n}.",
  ];
  for (const t of tickets) {
    const count = t.status === "resolved" ? intBetween(1, 4) : intBetween(0, 3);
    for (let i = 0; i < count; i++) {
      const author = i % 2 === 0 ? pick(agents) : t.account_name;
      comments.push({
        ticket_id: t.id,
        author,
        body: pick(templates).replace("{n}", String(intBetween(100, 999))),
        timestamp: t.created_at + (i + 1) * intBetween(1, 8) * 3600000,
      });
    }
  }
  return comments.sort((a, b) => b.timestamp - a.timestamp);
}

// ---- Incident Updates ----
export function seedIncidentUpdates(incidents) {
  const updates = [];
  const handlers = ["dana.zhou", "lee.patel", "sam.owens"];
  const messages = [
    "Investigating elevated error rates.",
    "Root cause identified: cache invalidation failure.",
    "Mitigation applied. Monitoring recovery.",
    "Services recovering. Latency returning to normal.",
    "Postmortem scheduled.",
    "Permanent fix deployed.",
    "All clear. Incident resolving.",
  ];
  for (const inc of incidents) {
    const count = intBetween(1, Math.min(5, messages.length));
    for (let i = 0; i < count; i++) {
      updates.push({
        incident_id: inc.id,
        author: pick(handlers),
        message: messages[i],
        timestamp: inc.opened_at + i * intBetween(10, 120) * 60000,
      });
    }
  }
  return updates.sort((a, b) => b.timestamp - a.timestamp);
}

// ---- Deploy Checks ----
export function seedDeployChecks(deployments) {
  const checks = {};
  const checkNames = ["lint", "unit_tests", "integration_tests", "security_scan", "bundle_size", "canary_health", "db_migration_check"];
  for (const dep of deployments) {
    const count = intBetween(3, checkNames.length);
    const depChecks = checkNames.slice(0, count).map(name => ({
      name,
      passed: nx() > 0.12,
      duration_s: intBetween(1, 120),
    }));
    checks[dep.id] = depChecks;
  }
  return checks;
}

// ---- Experiment Daily Samples ----
export function seedExperimentSamples(experiments) {
  const samples = {};
  for (const exp of experiments) {
    if (exp.status === "draft") continue;
    const days = Math.min(30, Math.floor((NOW_TS - exp.started_at) / DAY));
    const expSamples = [];
    for (let d = 0; d < days; d++) {
      const noise = (nx() - 0.5) * 2;
      expSamples.push({
        experiment_id: exp.id,
        day: d,
        timestamp: exp.started_at + d * DAY,
        variant_a_metric: parseFloat((1 + noise * 0.5).toFixed(4)),
        variant_b_metric: parseFloat((1 + exp.lift_pct / 100 + noise * 0.3).toFixed(4)),
        lift_pct: parseFloat((exp.lift_pct + noise).toFixed(2)),
      });
    }
    samples[exp.id] = expSamples;
  }
  return samples;
}

// ---- Usage anomaly events (for interest) ----
export function seedUsageAnomalies(accounts) {
  const anomalies = [];
  for (const a of accounts) {
    if (nx() > 0.25) continue; // ~25% of accounts have an anomaly
    const ts = dateBetween(NOW_TS - 60 * DAY, NOW_TS);
    anomalies.push({
      account_id: a.id,
      account_name: a.name,
      type: pick(["spike", "drop", "gap"]),
      severity: pick(["low", "medium", "high"]),
      timestamp: ts,
      description: pick([
        "Usage dropped 60% for 2 days",
        "Unexpected spike in API calls",
        "3-day gap with no activity",
        "Weekend usage anomaly detected",
      ]),
    });
  }
  return anomalies.sort((a, b) => b.timestamp - a.timestamp);
}

// Assemble
export function seedAllFixtures(state) {
  const segments = seedSegments(state.accounts);
  const contracts = seedContracts(state.accounts);
  const invoices = seedInvoices(state.accounts);
  const usageEvents = seedUsageEvents(state.accounts);
  const npsResponses = seedNps(state.accounts);
  const successPlans = seedSuccessPlans(state.accounts, contracts);
  const featureAdoption = seedFeatureAdoption(state.accounts);
  const ticketComments = seedTicketComments(state.tickets);
  const incidentUpdates = seedIncidentUpdates(state.incidents);
  const deployChecks = seedDeployChecks(state.deployments);
  const experimentSamples = seedExperimentSamples(state.experiments);
  const usageAnomalies = seedUsageAnomalies(state.accounts);

  // Attach feature adoption to accounts
  for (const a of state.accounts) {
    const fa = featureAdoption[a.id];
    if (fa) a.feature_adoption = fa.rate;
  }

  // Attach comments to tickets
  for (const t of state.tickets) {
    t.comments = ticketComments.filter(c => c.ticket_id === t.id);
  }

  // Attach updates to incidents
  for (const inc of state.incidents) {
    inc.updates = incidentUpdates.filter(u => u.incident_id === inc.id);
  }

  return {
    segments,
    contracts,
    invoices,
    usageEvents,
    npsResponses,
    successPlans,
    featureAdoption,
    ticketComments,
    incidentUpdates,
    deployChecks,
    experimentSamples,
    usageAnomalies,
  };
}
