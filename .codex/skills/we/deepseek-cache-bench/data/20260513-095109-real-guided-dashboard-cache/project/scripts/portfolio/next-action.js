// Next-best-action recommender for the portfolio view.
// Uses health score, engagement, renewal proximity, open tickets, and expansion signals.

const DAY = 86400000;
const NOW = Date.now();

const ACTION_TEMPLATES = [
  {
    id: "urgent_retention",
    label: "Schedule urgent retention call",
    priority: "critical",
    condition: (ctx) => ctx.healthScore < 40,
  },
  {
    id: "renewal_review",
    label: "Prepare renewal proposal",
    priority: "high",
    condition: (ctx) => ctx.daysUntilRenewal != null && ctx.daysUntilRenewal <= 30 && ctx.healthScore < 70,
  },
  {
    id: "qbr_schedule",
    label: "Schedule QBR",
    priority: "high",
    condition: (ctx) => ctx.daysUntilRenewal != null && ctx.daysUntilRenewal <= 90 && ctx.daysUntilRenewal > 30,
  },
  {
    id: "expansion_discussion",
    label: "Discuss expansion opportunity",
    priority: "medium",
    condition: (ctx) => ctx.expansionScore >= 60 && ctx.healthScore >= 60,
  },
  {
    id: "engagement_boost",
    label: "Send re-engagement campaign",
    priority: "medium",
    condition: (ctx) => ctx.engagementScore < 35 && ctx.healthScore >= 40,
  },
  {
    id: "success_plan_review",
    label: "Review success plan progress",
    priority: "medium",
    condition: (ctx) => ctx.successPlanPct != null && ctx.successPlanPct < 0.5,
  },
  {
    id: "ticket_triage",
    label: "Triage open critical tickets",
    priority: "high",
    condition: (ctx) => ctx.openCriticalTickets > 0,
  },
  {
    id: "csat_recovery",
    label: "CSAT recovery outreach",
    priority: "medium",
    condition: (ctx) => ctx.avgCsat != null && ctx.avgCsat < 2.5,
  },
  {
    id: "feature_adoption_workshop",
    label: "Feature adoption workshop",
    priority: "low",
    condition: (ctx) => ctx.featureAdoptionRate != null && ctx.featureAdoptionRate < 0.3,
  },
  {
    id: "stakeholder_checkin",
    label: "Check in with executive sponsor",
    priority: "low",
    condition: (ctx) => ctx.hasStakeholders && ctx.daysUntilRenewal != null && ctx.daysUntilRenewal <= 60,
  },
  {
    id: "health_improving_monitor",
    label: "Monitor — health improving",
    priority: "low",
    condition: (ctx) => ctx.healthScore >= 60 && ctx.healthTrend === "improving",
  },
];

const FALLBACK = { id: "regular_cadence", label: "Maintain regular cadence", priority: "low" };

export function recommendActions(account, context) {
  const ctx = { ...context, account };

  // Build context from available data
  const actions = [];
  for (const tmpl of ACTION_TEMPLATES) {
    try {
      if (tmpl.condition(ctx)) {
        actions.push({
          action_id: tmpl.id,
          label: tmpl.label,
          priority: tmpl.priority,
          account_id: account.id,
          account_name: account.name,
        });
      }
    } catch (_) { /* skip if context missing */ }
  }

  if (actions.length === 0) {
    actions.push({ ...FALLBACK, account_id: account.id, account_name: account.name });
  }

  // Deduplicate: keep highest priority per category
  const priorityRank = { critical: 0, high: 1, medium: 2, low: 3 };
  actions.sort((a, b) => ((priorityRank[a.priority] ?? 99) - (priorityRank[b.priority] ?? 99)));

  // Return top 3
  return actions.slice(0, 3);
}

export function batchRecommend(accounts, contextBuilder) {
  const results = {};
  for (const a of accounts) {
    results[a.id] = recommendActions(a, contextBuilder(a));
  }
  return results;
}

export function actionSummary(actionMap) {
  const byPriority = { critical: 0, high: 0, medium: 0, low: 0 };
  const byType = {};
  for (const actions of Object.values(actionMap)) {
    for (const a of actions) {
      byPriority[a.priority] = (byPriority[a.priority] || 0) + 1;
      byType[a.action_id] = (byType[a.action_id] || 0) + 1;
    }
  }
  return { byPriority, byType, totalAccounts: Object.keys(actionMap).length };
}
