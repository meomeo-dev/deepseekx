// Usage fixtures — features, seats, user activity, onboarding, training, feedback.

const NOW = Date.now();
const DAY = 86400000;

let s = 881;
function nx() { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; }
function pick(arr) { return arr[Math.floor(nx() * arr.length)]; }
function intBetween(a, b) { return Math.floor(a + nx() * (b - a + 1)); }
function dateBetween(lo, hi) { return Math.floor(lo + nx() * (hi - lo)); }

// ---- Feature Catalog ----
export function seedFeatureCatalog() {
  return [
    { id: "dashboard", name: "Dashboard", category: "core", tier: "starter" },
    { id: "reporting", name: "Reporting & Exports", category: "analytics", tier: "growth" },
    { id: "api_access", name: "API Access", category: "integrations", tier: "growth" },
    { id: "sso", name: "SSO / SAML", category: "security", tier: "business" },
    { id: "audit_log", name: "Audit Log", category: "compliance", tier: "business" },
    { id: "webhooks", name: "Webhooks", category: "integrations", tier: "business" },
    { id: "automations", name: "Workflow Automations", category: "productivity", tier: "growth" },
    { id: "custom_fields", name: "Custom Fields", category: "configuration", tier: "business" },
    { id: "dedicated_support", name: "Dedicated Support", category: "support", tier: "enterprise" },
    { id: "sla_guarantee", name: "SLA Guarantee", category: "support", tier: "enterprise" },
  ];
}

// ---- Feature Adoption (depth and detail) ----
export function seedFeatureAdoptionDetail(accounts, featureCatalog) {
  const adoption = {};
  for (const a of accounts) {
    const planFeatures = { Starter: 3, Growth: 5, Business: 7, Enterprise: 9 };
    const maxF = planFeatures[a.plan] || featureCatalog.length;
    const relevantFeatures = featureCatalog.slice(0, maxF);

    const count = a.health === "healthy" ? intBetween(2, maxF)
      : a.health === "at_risk" ? intBetween(1, Math.floor(maxF * 0.5))
      : 0;

    const adopted = [];
    const featureDepth = {};
    for (let i = 0; i < Math.min(count, relevantFeatures.length); i++) {
      adopted.push(relevantFeatures[i].id);
      featureDepth[relevantFeatures[i].id] = intBetween(30, 95);
    }

    adoption[a.id] = {
      adopted_features: adopted,
      unused_features: relevantFeatures.filter(f => !adopted.includes(f.id)).map(f => f.id),
      feature_depth: featureDepth,
      rate: relevantFeatures.length > 0 ? adopted.length / relevantFeatures.length : 0,
    };
  }
  return adoption;
}

// ---- Seat Activity ----
export function seedSeatActivity(accounts) {
  const activity = {};
  const names = ["alice", "bob", "carol", "dave", "eve", "frank", "grace", "heidi", "ivan", "judy"];
  for (const a of accounts) {
    if (a.health === "churned") continue;
    const seats = Math.min(a.seats || 10, 10);
    const seatList = [];
    for (let i = 0; i < seats; i++) {
      const active = nx() > 0.3;
      seatList.push({
        user_name: names[i] || `user_${i}`,
        email: `${names[i] || `user_${i}`}@${a.name.toLowerCase().replace(/[^a-z]/g, "")}.com`,
        last_active: active ? dateBetween(NOW - 30 * DAY, NOW) : (nx() > 0.5 ? dateBetween(NOW - 90 * DAY, NOW - 31 * DAY) : null),
        role: i === 0 ? "admin" : pick(["editor", "viewer", "viewer"]),
      });
    }
    activity[a.id] = seatList;
  }
  return activity;
}

// ---- Onboarding Events ----
export function seedOnboardingEvents(accounts) {
  const events = [];
  const milestoneIds = [
    "account_created", "first_login", "integration_connected",
    "first_data_import", "team_invited", "first_value_milestone",
    "workflow_created", "onboarding_complete",
  ];
  for (const a of accounts) {
    if (a.health === "churned") continue;
    const completeCount = a.health === "healthy" ? intBetween(4, 8) : intBetween(1, 4);
    for (let i = 0; i < completeCount; i++) {
      events.push({
        account_id: a.id,
        milestone_id: milestoneIds[i] || `ms_${i}`,
        completed: true,
        completed_at: a.created_at + intBetween(i * 2, (i + 1) * 10) * DAY,
      });
    }
    // Some incomplete ones
    if (completeCount < milestoneIds.length && nx() > 0.4) {
      events.push({
        account_id: a.id,
        milestone_id: milestoneIds[completeCount],
        completed: false,
        completed_at: null,
      });
    }
  }
  return events;
}

// ---- Training Sessions ----
export function seedTrainingSessions(accounts) {
  const sessions = [];
  const types = ["live_workshop", "on_demand_video", "office_hours", "exec_briefing"];
  for (const a of accounts) {
    if (a.health === "churned" || nx() > 0.5) continue;
    sessions.push({
      id: `train_${a.id}_${sessions.length}`,
      account_id: a.id,
      account_name: a.name,
      type: pick(types),
      topic: pick(["Getting Started", "Advanced Reporting", "API Integration", "Security Best Practices", "Workflow Automation"]),
      attended_count: intBetween(1, 5),
      scheduled_date: dateBetween(NOW - 60 * DAY, NOW + 30 * DAY),
      completed: nx() > 0.3,
    });
  }
  return sessions.sort((a, b) => b.scheduled_date - a.scheduled_date);
}

// ---- Product Feedback ----
export function seedProductFeedback(accounts) {
  const feedback = [];
  const categories = ["feature_request", "bug_report", "ux_improvement", "performance", "integration"];
  const statuses = ["submitted", "under_review", "planned", "in_development", "shipped"];
  for (const a of accounts) {
    if (a.health === "churned" || nx() > 0.6) continue;
    feedback.push({
      id: `fb_${a.id}_${feedback.length}`,
      account_id: a.id,
      account_name: a.name,
      category: pick(categories),
      title: pick([
        "Need bulk export to CSV", "Dashboard loading slowly", "SSO setup is confusing",
        "API rate limits too low", "Would like dark mode", "Mobile app needed",
      ]),
      status: pick(statuses),
      votes: intBetween(1, 15),
      submitted_at: dateBetween(NOW - 180 * DAY, NOW),
    });
  }
  return feedback.sort((a, b) => b.submitted_at - a.submitted_at);
}

// ---- Usage Thresholds ----
export function seedUsageThresholds() {
  return {
    heavy_usage_days: 20,
    moderate_usage_days: 10,
    dormant_days: 60,
    inactive_seat_days: 30,
    onboarding_stuck_days: 21,
    anomaly_resolution_days: 7,
  };
}

// ---- Feature Dependencies ----
export function seedFeatureDependencies() {
  return {
    reporting: ["dashboard"],
    api_access: ["dashboard"],
    webhooks: ["api_access"],
    automations: ["webhooks", "custom_fields"],
    sso: [],
    audit_log: [],
    custom_fields: [],
    dedicated_support: [],
    sla_guarantee: [],
  };
}

export function seedAllUsageFixtures(state) {
  const featureCatalog = seedFeatureCatalog();
  return {
    featureCatalog,
    featureAdoptionDetail: seedFeatureAdoptionDetail(state.accounts, featureCatalog),
    seatActivity: seedSeatActivity(state.accounts),
    onboardingEvents: seedOnboardingEvents(state.accounts),
    trainingSessions: seedTrainingSessions(state.accounts),
    productFeedback: seedProductFeedback(state.accounts),
    usageThresholds: seedUsageThresholds(),
    featureDependencies: seedFeatureDependencies(),
  };
}
