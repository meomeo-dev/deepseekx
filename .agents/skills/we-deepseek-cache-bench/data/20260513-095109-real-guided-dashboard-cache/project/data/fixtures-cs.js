// Customer-success fixtures — meetings, tasks, notes, stakeholders, expansion signals, owner capacity.

const NOW = Date.now();
const DAY = 86400000;

let s = 271;
function nx() { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; }
function pick(arr) { return arr[Math.floor(nx() * arr.length)]; }
function intBetween(a, b) { return Math.floor(a + nx() * (b - a + 1)); }
function dateBetween(lo, hi) { return Math.floor(lo + nx() * (hi - lo)); }

const CS_OWNERS = ["emma.wu", "raj.patel", "lisa.chen", "omar.jones"];

// ---- Owner Capacity ----
export function seedOwnerCapacity() {
  return {
    "emma.wu":    { max_accounts: 35, max_renewals_per_month: 7,  name: "Emma Wu",    tier: "senior" },
    "raj.patel":  { max_accounts: 40, max_renewals_per_month: 8,  name: "Raj Patel",   tier: "senior" },
    "lisa.chen":  { max_accounts: 30, max_renewals_per_month: 6,  name: "Lisa Chen",   tier: "mid" },
    "omar.jones": { max_accounts: 25, max_renewals_per_month: 5,  name: "Omar Jones",  tier: "junior" },
  };
}

// ---- Meetings / QBRs ----
export function seedMeetings(accounts, contracts) {
  const meetings = [];
  const types = ["qbr", "check_in", "onboarding", "escalation", "renewal_discussion"];
  for (const a of accounts) {
    if (a.health === "churned") continue;
    const contract = contracts[a.id];
    const owner = contract?.cs_owner;

    // QBR for accounts with renewal in next 90 days
    if (contract?.renewal_date && nx() > 0.4) {
      meetings.push({
        id: `mtg_${a.id}_qbr`,
        account_id: a.id,
        account_name: a.name,
        type: "qbr",
        title: `QBR — ${a.name}`,
        scheduled: dateBetween(NOW - 15 * DAY, NOW + 60 * DAY),
        owner,
        status: nx() > 0.3 ? "upcoming" : "completed",
        notes: pick(["Reviewed adoption metrics", "Aligned on Q3 goals", "Discussed expansion path", "Addressed support concerns"]),
      });
    }

    // Regular check-ins
    if (nx() > 0.5) {
      meetings.push({
        id: `mtg_${a.id}_checkin`,
        account_id: a.id,
        account_name: a.name,
        type: "check_in",
        title: `Monthly Check-in — ${a.name}`,
        scheduled: dateBetween(NOW - 30 * DAY, NOW + 14 * DAY),
        owner,
        status: pick(["upcoming", "upcoming", "completed"]),
        notes: null,
      });
    }

    // Escalation meetings for at-risk
    if (a.health === "at_risk" && nx() > 0.3) {
      meetings.push({
        id: `mtg_${a.id}_esc`,
        account_id: a.id,
        account_name: a.name,
        type: "escalation",
        title: `Risk Review — ${a.name}`,
        scheduled: dateBetween(NOW - 7 * DAY, NOW + 7 * DAY),
        owner,
        status: pick(["upcoming", "completed"]),
        notes: "Health score declining. Need intervention plan.",
      });
    }
  }
  return meetings.sort((a, b) => a.scheduled - b.scheduled);
}

// ---- Renewal Tasks ----
export function seedRenewalTasks(accounts, contracts) {
  const tasks = [];
  const taskTemplates = [
    { title: "Send renewal quote", offset_days: -60 },
    { title: "Confirm stakeholder alignment", offset_days: -45 },
    { title: "Review success metrics", offset_days: -30 },
    { title: "Present renewal proposal", offset_days: -21 },
    { title: "Negotiate terms", offset_days: -14 },
    { title: "Send contract for signature", offset_days: -7 },
    { title: "Confirm renewal complete", offset_days: 0 },
  ];
  for (const a of accounts) {
    if (a.health === "churned") continue;
    const contract = contracts[a.id];
    if (!contract?.renewal_date) continue;

    for (const tmpl of taskTemplates) {
      const due = contract.renewal_date + tmpl.offset_days * DAY;
      const completed = due < NOW - 7 * DAY ? nx() > 0.3 : nx() > 0.7;
      tasks.push({
        id: `task_${a.id}_${tmpl.offset_days}`,
        account_id: a.id,
        account_name: a.name,
        title: tmpl.title,
        due_date: due,
        completed,
        completed_at: completed ? due + intBetween(-5, 3) * DAY : null,
        owner: contract.cs_owner,
        category: "renewal",
      });
    }
  }
  // Add some ad-hoc tasks
  const adhoc = [
    "Follow up on feature request", "Send NPS survey", "Update account plan",
    "Document support escalation path", "Verify billing contact", "Share product roadmap",
  ];
  for (const a of accounts.filter(a => a.health !== "churned" && nx() > 0.6)) {
    tasks.push({
      id: `task_${a.id}_adhoc`,
      account_id: a.id,
      account_name: a.name,
      title: pick(adhoc),
      due_date: dateBetween(NOW, NOW + 30 * DAY),
      completed: false,
      completed_at: null,
      owner: pick(CS_OWNERS),
      category: "general",
    });
  }
  return tasks.sort((a, b) => a.due_date - b.due_date);
}

// ---- Account Notes ----
export function seedAccountNotes(accounts) {
  const notes = [];
  const templates = [
    "Customer expressed interest in upgrading to {plan}.",
    "Key contact {name} left the company. New POC being established.",
    "Usage declined after new feature rollout. CSM investigating.",
    "Customer requested custom integration. Engineering evaluating.",
    "Positive feedback on latest release. NPS likely improving.",
    "Competitor {comp} is actively courting this account.",
    "Budget review coming up. Need to demonstrate ROI.",
    "Executive sponsor changed. Need to rebuild relationship.",
    "Account expanding to new department. Potential seat growth.",
    "Support ticket volume spiking. May indicate frustration.",
  ];
  const comps = ["CompetitorX", "LegacySuite", "CloudOpz"];
  const cNames = ["Sarah Chen", "Marcus Webb", "Jordan Park", "Alex Rivera"];

  for (const a of accounts) {
    const count = intBetween(0, 4);
    for (let i = 0; i < count; i++) {
      let body = pick(templates)
        .replace("{plan}", pick(["Growth", "Business", "Enterprise"]))
        .replace("{name}", pick(cNames))
        .replace("{comp}", pick(comps));
      notes.push({
        id: `note_${a.id}_${i}`,
        account_id: a.id,
        account_name: a.name,
        body,
        author: pick(CS_OWNERS),
        timestamp: dateBetween(NOW - 180 * DAY, NOW),
        pinned: nx() > 0.85,
      });
    }
  }
  return notes.sort((a, b) => b.timestamp - a.timestamp);
}

// ---- Stakeholders ----
export function seedStakeholders(accounts) {
  const stakeholders = [];
  const roles = ["Executive Sponsor", "Champion", "Decision Maker", "Admin", "End User", "Procurement"];
  const names = ["Sarah Chen", "Marcus Webb", "Jordan Park", "Alex Rivera", "Taylor Kim", "Morgan Blake", "Casey Nguyen", "Riley Jordan"];

  for (const a of accounts) {
    const count = intBetween(1, 4);
    for (let i = 0; i < count; i++) {
      stakeholders.push({
        id: `stkh_${a.id}_${i}`,
        account_id: a.id,
        account_name: a.name,
        name: pick(names),
        role: pick(roles),
        influence: pick(["high", "medium", "low"]),
        sentiment: a.health === "healthy" ? pick(["positive","positive","neutral"]) :
                    a.health === "at_risk" ? pick(["neutral","negative","neutral"]) :
                    pick(["negative","negative","neutral"]),
        last_contact: dateBetween(NOW - 90 * DAY, NOW),
      });
    }
  }
  return stakeholders;
}

// ---- Expansion Signals ----
export function seedExpansionSignals(accounts) {
  const signals = [];
  const signalTypes = [
    { type: "seat_growth_request", label: "Requested additional seats", weight: 5 },
    { type: "feature_inquiry", label: "Inquired about premium features", weight: 4 },
    { type: "department_expansion", label: "Expanding to new department", weight: 6 },
    { type: "budget_approval", label: "Budget approved for expansion", weight: 7 },
    { type: "benchmark_request", label: "Requested upgrade pricing", weight: 3 },
    { type: "integration_request", label: "Requested enterprise integration", weight: 4 },
  ];

  for (const a of accounts) {
    if (a.health === "churned") continue;
    if (nx() > 0.55) continue;
    const count = intBetween(1, 3);
    for (let i = 0; i < count; i++) {
      const sig = pick(signalTypes);
      signals.push({
        id: `sig_${a.id}_${i}`,
        account_id: a.id,
        account_name: a.name,
        type: sig.type,
        label: sig.label,
        weight: sig.weight,
        timestamp: dateBetween(NOW - 120 * DAY, NOW),
        source: pick(["cs_call", "email", "support_ticket", "nps_survey"]),
      });
    }
  }
  return signals.sort((a, b) => b.timestamp - a.timestamp);
}

// ---- Contract Terms (extensions beyond basics) ----
export function seedContractTerms(accounts, contracts) {
  const terms = {};
  for (const a of accounts) {
    const c = contracts[a.id];
    if (!c) continue;
    terms[a.id] = {
      ...c,
      payment_terms: pick(["annual", "annual", "quarterly", "monthly"]),
      contract_type: pick(["standard", "standard", "standard", "custom_msa"]),
      has_opt_out_clause: nx() > 0.7,
      price_lock_until: c.renewal_date,
      included_support: a.plan === "Enterprise" ? "premium_24_7" : a.plan === "Business" ? "business_hours_priority" : "standard",
      sla_tier: a.plan === "Enterprise" ? "99.99" : a.plan === "Business" ? "99.9" : "99.5",
      data_processing_addendum: a.plan === "Enterprise" || a.plan === "Business",
    };
  }
  return terms;
}

// Assemble
export function seedAllCSFixtures(state, contracts) {
  const ownerCapacity = seedOwnerCapacity();
  const meetings = seedMeetings(state.accounts, contracts);
  const renewalTasks = seedRenewalTasks(state.accounts, contracts);
  const accountNotes = seedAccountNotes(state.accounts);
  const stakeholders = seedStakeholders(state.accounts);
  const expansionSignals = seedExpansionSignals(state.accounts);
  const contractTerms = seedContractTerms(state.accounts, contracts);

  return {
    ownerCapacity,
    meetings,
    renewalTasks,
    accountNotes,
    stakeholders,
    expansionSignals,
    contractTerms,
  };
}
