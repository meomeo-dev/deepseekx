// Onboarding milestone tracking — measures time-to-value and milestone completion.

const DAY = 86400000;
const NOW = Date.now();

const STANDARD_MILESTONES = [
  { id: "account_created", name: "Account Created", target_days: 0, weight: 5 },
  { id: "first_login", name: "First Login", target_days: 1, weight: 10 },
  { id: "integration_connected", name: "Integration Connected", target_days: 7, weight: 15 },
  { id: "first_data_import", name: "First Data Import", target_days: 10, weight: 15 },
  { id: "team_invited", name: "Team Members Invited", target_days: 14, weight: 10 },
  { id: "first_value_milestone", name: "First Value Milestone", target_days: 21, weight: 20 },
  { id: "workflow_created", name: "First Workflow Created", target_days: 28, weight: 10 },
  { id: "onboarding_complete", name: "Onboarding Complete", target_days: 45, weight: 15 },
];

export function trackOnboarding(account, onboardingEvents) {
  const events = (onboardingEvents || []).filter(e => e.account_id === account.id);
  const completedIds = new Set(events.filter(e => e.completed).map(e => e.milestone_id));

  const milestones = STANDARD_MILESTONES.map(m => {
    const event = events.find(e => e.milestone_id === m.id);
    const completed = completedIds.has(m.id);
    const completedAt = event?.completed_at || null;
    const daysToComplete = completedAt
      ? Math.round((completedAt - account.created_at) / DAY)
      : null;
    const onTime = daysToComplete !== null && daysToComplete <= m.target_days;

    return {
      id: m.id,
      name: m.name,
      target_days: m.target_days,
      completed,
      completed_at: completedAt,
      days_to_complete: daysToComplete,
      on_time: onTime,
      overdue: !completed && ((NOW - account.created_at) / DAY) > m.target_days,
    };
  });

  const completedCount = milestones.filter(m => m.completed).length;
  const totalWeight = STANDARD_MILESTONES.reduce((s, m) => s + m.weight, 0);
  const earnedWeight = milestones
    .filter(m => m.completed)
    .reduce((s, m) => s + (STANDARD_MILESTONES.find(sm => sm.id === m.id)?.weight || 0), 0);

  const progressPct = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;

  // Time-to-value: days until first_value_milestone
  const fvm = milestones.find(m => m.id === "first_value_milestone");
  const ttv = fvm?.days_to_complete || null;

  // Status
  let status;
  if (progressPct >= 100) status = "complete";
  else if (progressPct >= 60) status = "on_track";
  else if (progressPct >= 30) status = "in_progress";
  else status = "not_started";

  // Stuck detection: no progress in 14 days
  const lastCompletedEvent = events.filter(e => e.completed)
    .sort((a, b) => (b.completed_at || 0) - (a.completed_at || 0))[0];
  const daysSinceLastMilestone = lastCompletedEvent?.completed_at
    ? Math.round((NOW - lastCompletedEvent.completed_at) / DAY)
    : Math.round((NOW - account.created_at) / DAY);
  const stuck = !fvm?.completed && daysSinceLastMilestone > 21;

  return {
    account_id: account.id,
    account_name: account.name,
    plan: account.plan,
    progress_pct: progressPct,
    status,
    completed_milestones: completedCount,
    total_milestones: STANDARD_MILESTONES.length,
    time_to_value_days: ttv,
    days_since_last_milestone: daysSinceLastMilestone,
    stuck,
    overdue_milestones: milestones.filter(m => m.overdue).length,
    milestones,
  };
}

export function batchTrackOnboarding(accounts, onboardingEvents) {
  return accounts
    .filter(a => a.health !== "churned")
    .map(a => trackOnboarding(a, onboardingEvents));
}

export function onboardingSummary(tracked) {
  const byStatus = {};
  let totalStuck = 0, totalOverdue = 0, completedTTV = [];
  for (const t of tracked) {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    if (t.stuck) totalStuck++;
    totalOverdue += t.overdue_milestones;
    if (t.time_to_value_days != null) completedTTV.push(t.time_to_value_days);
  }
  return {
    total_accounts: tracked.length,
    completed: byStatus.complete || 0,
    on_track: byStatus.on_track || 0,
    stuck: totalStuck,
    overdue_milestones_total: totalOverdue,
    avg_ttv_days: completedTTV.length
      ? Math.round(completedTTV.reduce((s, d) => s + d, 0) / completedTTV.length)
      : null,
  };
}
