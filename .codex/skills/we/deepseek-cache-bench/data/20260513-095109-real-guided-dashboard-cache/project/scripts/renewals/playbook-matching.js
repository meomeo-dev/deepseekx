// Playbook matching — maps account situations to predefined success plays.

const PLAYS = [
  {
    id: "exec_sponsor_engagement",
    name: "Executive Sponsor Engagement",
    description: "Connect executive sponsor with customer's leadership to reaffirm value.",
    triggers: [
      ctx => ctx.healthScore < 50 && ctx.mrr > 5000,
      ctx => ctx.renewalProbability < 0.6,
    ],
    match_all: false,
    effort: "high",
    category: "retention",
  },
  {
    id: "value_realization_workshop",
    name: "Value Realization Workshop",
    description: "Run a workshop to demonstrate ROI and align on success metrics.",
    triggers: [
      ctx => ctx.healthScore >= 50 && ctx.healthScore < 75 && ctx.engagementScore < 50,
      ctx => ctx.successPlanPct < 0.4,
    ],
    match_all: false,
    effort: "medium",
    category: "adoption",
  },
  {
    id: "feature_adoption_sprint",
    name: "Feature Adoption Sprint",
    description: "Two-week focused sprint to drive adoption of unused features.",
    triggers: [
      ctx => ctx.featureAdoptionRate < 0.3 && ctx.healthScore >= 40,
    ],
    match_all: true,
    effort: "medium",
    category: "adoption",
  },
  {
    id: "exec_business_review",
    name: "Executive Business Review",
    description: "Quarterly business review with stakeholders to align roadmap.",
    triggers: [
      ctx => ctx.mrr > 7500 && ctx.daysUntilRenewal <= 90 && ctx.daysUntilRenewal > 30,
    ],
    match_all: true,
    effort: "high",
    category: "retention",
  },
  {
    id: "renewal_incentive_package",
    name: "Renewal Incentive Package",
    description: "Offer multi-year discount or feature bundle to secure renewal.",
    triggers: [
      ctx => ctx.renewalProbability < 0.7 && ctx.daysUntilRenewal <= 60,
    ],
    match_all: true,
    effort: "medium",
    category: "retention",
  },
  {
    id: "expansion_roadmap_session",
    name: "Expansion Roadmap Session",
    description: "Present product roadmap and expansion options to grow the account.",
    triggers: [
      ctx => ctx.expansionScore >= 50 && ctx.healthScore >= 60,
    ],
    match_all: true,
    effort: "medium",
    category: "expansion",
  },
  {
    id: "health_recovery_plan",
    name: "Health Recovery Plan",
    description: "Structured 30-day plan to address health issues and reduce churn risk.",
    triggers: [
      ctx => ctx.healthScore < 30,
    ],
    match_all: true,
    effort: "high",
    category: "retention",
  },
  {
    id: "csat_recovery_program",
    name: "CSAT Recovery Program",
    description: "Dedicated outreach to address dissatisfaction and rebuild trust.",
    triggers: [
      ctx => ctx.avgCsat < 2.5 && ctx.healthScore < 60,
    ],
    match_all: true,
    effort: "medium",
    category: "retention",
  },
  {
    id: "stakeholder_mapping",
    name: "Stakeholder Mapping & Alignment",
    description: "Map decision-makers and influencers. Ensure all have positive sentiment.",
    triggers: [
      ctx => ctx.hasStakeholders && ctx.daysUntilRenewal <= 60 && ctx.renewalProbability < 0.8,
    ],
    match_all: true,
    effort: "low",
    category: "retention",
  },
  {
    id: "qbr_prep_kit",
    name: "QBR Preparation Kit",
    description: "Send pre-QBR package with usage stats, ROI summary, and agenda.",
    triggers: [
      ctx => ctx.hasUpcomingQbr,
    ],
    match_all: true,
    effort: "low",
    category: "adoption",
  },
  {
    id: "at_risk_playbook",
    name: "At-Risk Account Playbook",
    description: "Full intervention: CSM escalation, exec alignment, success plan reset.",
    triggers: [
      ctx => ctx.health === "at_risk" && ctx.mrr >= 3500,
    ],
    match_all: true,
    effort: "high",
    category: "retention",
  },
];

export function matchPlaybooks(account, context) {
  const matched = [];
  for (const play of PLAYS) {
    const results = play.triggers.map(fn => {
      try { return fn(context); } catch (_) { return false; }
    });
    const matches = play.match_all ? results.every(Boolean) : results.some(Boolean);
    if (matches) {
      matched.push({ ...play, account_id: account.id, account_name: account.name });
    }
  }
  // Sort by effort priority: high first
  const effortRank = { high: 0, medium: 1, low: 2 };
  matched.sort((a, b) => ((effortRank[a.effort] ?? 99) - (effortRank[b.effort] ?? 99)));
  return matched.slice(0, 3);
}

export function batchMatch(accounts, contextBuilder) {
  const results = {};
  for (const a of accounts) {
    results[a.id] = matchPlaybooks(a, contextBuilder(a));
  }
  return results;
}

export function playbookSummary(matchedMap) {
  const byPlay = {};
  let totalMatches = 0;
  for (const plays of Object.values(matchedMap)) {
    for (const p of plays) {
      byPlay[p.id] = (byPlay[p.id] || 0) + 1;
      totalMatches++;
    }
  }
  return {
    total_accounts_with_plays: Object.values(matchedMap).filter(p => p.length > 0).length,
    total_matches: totalMatches,
    byPlay: Object.entries(byPlay)
      .map(([id, count]) => {
        const play = PLAYS.find(p => p.id === id);
        return { id, name: play?.name || id, count, category: play?.category || "unknown" };
      })
      .sort((a, b) => b.count - a.count),
  };
}
