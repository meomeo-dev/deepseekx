// Adoption playbook recommendation — matches adoption gaps to enablement plays.

const PLAYS = [
  {
    id: "onboarding_accelerator",
    name: "Onboarding Accelerator",
    description: "Fast-track stuck onboardings with dedicated specialist support.",
    triggers: [(ctx) => ctx.onboardingStuck && ctx.progressPct < 50],
    effort: "high",
    category: "onboarding",
  },
  {
    id: "feature_discovery_workshop",
    name: "Feature Discovery Workshop",
    description: "Interactive session showcasing high-value unused features.",
    triggers: [(ctx) => ctx.unusedFeatures >= 3],
    effort: "medium",
    category: "adoption",
  },
  {
    id: "power_user_ambassador",
    name: "Power User Ambassador Program",
    description: "Enlist power users as internal champions for peer adoption.",
    triggers: [(ctx) => ctx.adoptionLevel === "power_user"],
    effort: "low",
    category: "community",
  },
  {
    id: "seat_optimization_review",
    name: "Seat Optimization Review",
    description: "Review inactive seats and right-size the license allocation.",
    triggers: [(ctx) => ctx.seatUtilization < 60],
    effort: "low",
    category: "optimization",
  },
  {
    id: "reengagement_campaign",
    name: "Re-engagement Campaign",
    description: "Automated email sequence to re-engage dormant users.",
    triggers: [(ctx) => ctx.usageLevel === "dormant"],
    effort: "medium",
    category: "engagement",
  },
  {
    id: "training_bootcamp",
    name: "Training Bootcamp",
    description: "Two-day intensive training for accounts with low feature depth.",
    triggers: [(ctx) => ctx.adoptionScore < 40 && ctx.mrr > 3000],
    effort: "high",
    category: "training",
  },
  {
    id: "exec_sponsor_alignment",
    name: "Executive Sponsor Alignment",
    description: "Connect executive sponsor with account leadership to drive adoption.",
    triggers: [(ctx) => ctx.adoptionScore < 30 && ctx.mrr > 5000],
    effort: "high",
    category: "executive",
  },
  {
    id: "inline_guidance_campaign",
    name: "In-App Guidance Campaign",
    description: "Enable contextual tooltips and walkthroughs for underused features.",
    triggers: [(ctx) => ctx.featureDepth < 40 && ctx.unusedFeatures > 0],
    effort: "low",
    category: "product",
  },
  {
    id: "health_recovery_adoption",
    name: "Health Recovery Through Adoption",
    description: "Use feature adoption as a churn prevention lever for at-risk accounts.",
    triggers: [(ctx) => ctx.health === "at_risk" && ctx.adoptionScore < 50],
    effort: "high",
    category: "retention",
  },
];

export function recommendPlaybooks(context) {
  const matched = [];

  for (const play of PLAYS) {
    for (const trigger of play.triggers) {
      try {
        if (trigger(context)) {
          matched.push({ ...play });
          break;
        }
      } catch (_) { /* skip */ }
    }
  }

  const effortRank = { high: 0, medium: 1, low: 2 };
  matched.sort((a, b) => (effortRank[a.effort] ?? 99) - (effortRank[b.effort] ?? 99));
  return matched.slice(0, 4);
}

export function batchRecommend(accounts, contextBuilder) {
  const results = {};
  for (const a of accounts) {
    const ctx = contextBuilder(a);
    results[a.id] = recommendPlaybooks(ctx);
  }
  return results;
}

export function playbookSummary(matchedMap) {
  const byPlay = {};
  let totalMatches = 0;
  for (const plays of Object.values(matchedMap)) {
    totalMatches += plays.length;
    for (const p of plays) {
      byPlay[p.id] = (byPlay[p.id] || 0) + 1;
    }
  }
  return {
    accounts_with_plays: Object.values(matchedMap).filter(p => p.length > 0).length,
    total_matches: totalMatches,
    top_plays: Object.entries(byPlay)
      .map(([id, count]) => {
        const play = PLAYS.find(p => p.id === id);
        return { id, name: play?.name || id, count, category: play?.category || "unknown" };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
  };
}
