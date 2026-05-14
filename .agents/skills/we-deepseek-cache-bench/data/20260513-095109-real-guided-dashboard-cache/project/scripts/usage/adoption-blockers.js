// Adoption blocker detection — identifies why accounts aren't adopting features.

export function detectBlockers(account, featureAdoption, onboarding, tickets, npsResponses, trainingSessions) {
  const blockers = [];
  const ad = featureAdoption[account.id] || {};
  const onboard = onboarding.find(o => o.account_id === account.id);
  const accountTickets = (tickets || []).filter(t => t.account_id === account.id);
  const nps = (npsResponses || []).filter(n => n.account_id === account.id);
  const training = (trainingSessions || []).filter(t => t.account_id === account.id);

  // Blocker 1: Onboarding incomplete
  if (onboard && onboard.status !== "complete" && onboard.progress_pct < 60) {
    blockers.push({
      type: "onboarding_incomplete",
      severity: "high",
      detail: `Onboarding only ${onboard.progress_pct}% complete. ${onboard.overdue_milestones} overdue milestones.`,
      fix: "Assign onboarding specialist to accelerate milestones",
    });
  }

  // Blocker 2: No training sessions attended
  if (training.length === 0 && account.health !== "churned") {
    blockers.push({
      type: "no_training",
      severity: "medium",
      detail: "No training sessions completed. Users may not know how to use features.",
      fix: "Schedule feature walkthrough with CSM",
    });
  }

  // Blocker 3: Negative feedback
  const recentNps = nps.filter(n => n.timestamp > Date.now() - 90 * 86400000);
  if (recentNps.length > 0 && recentNps.every(n => n.score < 5)) {
    blockers.push({
      type: "negative_sentiment",
      severity: "high",
      detail: `Consistent low NPS (avg ${(recentNps.reduce((s,n) => s + n.score, 0) / recentNps.length).toFixed(1)}). Product dissatisfaction likely.`,
      fix: "Conduct customer interview to understand pain points",
    });
  }

  // Blocker 4: Support friction
  const unresolvedTickets = accountTickets.filter(t => t.status !== "resolved");
  if (unresolvedTickets.length >= 3) {
    blockers.push({
      type: "support_friction",
      severity: "medium",
      detail: `${unresolvedTickets.length} unresolved tickets. Support friction blocking adoption.`,
      fix: "Triage open tickets and resolve within 48 hours",
    });
  }

  // Blocker 5: Feature gap
  if (ad.unused_features && ad.unused_features.length >= 3) {
    blockers.push({
      type: "feature_discovery_gap",
      severity: "low",
      detail: `${ad.unused_features.length} relevant features not yet discovered.`,
      fix: "Send personalized feature discovery email",
    });
  }

  return {
    account_id: account.id,
    account_name: account.name,
    blocker_count: blockers.length,
    has_critical: blockers.some(b => b.severity === "high"),
    blockers: blockers.sort((a, b) =>
      (b.severity === "high" ? 3 : b.severity === "medium" ? 2 : 1) -
      (a.severity === "high" ? 3 : a.severity === "medium" ? 2 : 1)
    ),
  };
}

export function batchDetectBlockers(accounts, featureAdoption, onboarding, tickets, nps, training) {
  return accounts
    .filter(a => a.health !== "churned")
    .map(a => detectBlockers(a, featureAdoption, onboarding, tickets, nps, training))
    .sort((a, b) => b.blocker_count - a.blocker_count);
}

export function blockerSummary(detected) {
  const byType = {};
  let totalBlockers = 0, criticalCount = 0;
  for (const d of detected) {
    totalBlockers += d.blocker_count;
    if (d.has_critical) criticalCount++;
    for (const b of d.blockers) {
      byType[b.type] = (byType[b.type] || 0) + 1;
    }
  }
  return {
    total_accounts_with_blockers: detected.filter(d => d.blocker_count > 0).length,
    total_blockers: totalBlockers,
    critical_accounts: criticalCount,
    byType: Object.entries(byType).sort((a, b) => b[1] - a[1]),
  };
}
