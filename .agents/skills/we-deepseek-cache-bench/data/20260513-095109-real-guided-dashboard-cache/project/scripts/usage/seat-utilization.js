// Seat utilization analysis — detects inactive, underused, and over-provisioned seats.

const DAY = 86400000;
const NOW = Date.now();

export function analyzeSeatUtilization(account, seatActivity, thresholdDays) {
  const seats = (seatActivity && seatActivity[account.id]) || [];
  const inactiveThreshold = thresholdDays || 30;
  const cutoff = NOW - inactiveThreshold * DAY;

  const active = seats.filter(s => s.last_active >= cutoff);
  const inactive = seats.filter(s => s.last_active < cutoff);
  const neverUsed = seats.filter(s => !s.last_active);

  const totalSeats = seats.length || account.seats || 10;
  const utilization = totalSeats > 0 ? active.length / totalSeats : 0;

  let status;
  if (utilization >= 0.85) status = "healthy";
  else if (utilization >= 0.60) status = "moderate";
  else if (utilization >= 0.30) status = "underutilized";
  else status = "critical";

  // Over-provisioned estimate
  const excessSeats = Math.max(0, totalSeats - Math.ceil(active.length * 1.2));
  const potentialSavingsMRR = Math.round((excessSeats / totalSeats) * account.mrr * 0.3);

  return {
    account_id: account.id,
    account_name: account.name,
    plan: account.plan,
    total_seats: totalSeats,
    active_seats: active.length,
    inactive_seats: inactive.length,
    never_used: neverUsed.length,
    utilization_pct: parseFloat((utilization * 100).toFixed(1)),
    status,
    excess_seats: excessSeats,
    potential_savings_mrr: potentialSavingsMRR,
    top_inactive: inactive.slice(0, 5).map(s => ({
      user: s.user_name || s.email || "unknown",
      days_inactive: s.last_active ? Math.round((NOW - s.last_active) / DAY) : null,
    })),
  };
}

export function batchAnalyzeSeats(accounts, seatActivity) {
  return accounts
    .filter(a => a.health !== "churned")
    .map(a => analyzeSeatUtilization(a, seatActivity, 30))
    .sort((a, b) => a.utilization_pct - b.utilization_pct);
}

export function seatUtilizationSummary(analyzed) {
  const byStatus = {};
  let totalInactive = 0, totalSavings = 0;
  for (const a of analyzed) {
    byStatus[a.status] = (byStatus[a.status] || 0) + 1;
    totalInactive += a.inactive_seats;
    totalSavings += a.potential_savings_mrr;
  }
  return {
    total_accounts: analyzed.length,
    total_inactive_seats: totalInactive,
    total_potential_savings_mrr: totalSavings,
    byStatus,
    critical: byStatus.critical || 0,
    underutilized: byStatus.underutilized || 0,
    healthy: byStatus.healthy || 0,
  };
}
