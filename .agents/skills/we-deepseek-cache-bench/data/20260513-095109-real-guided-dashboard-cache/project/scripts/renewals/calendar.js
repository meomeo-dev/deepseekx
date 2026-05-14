// Renewal calendar — generates 120-day forward view of renewal events.

const DAY = 86400000;
const NOW = Date.now();

export function generateRenewalCalendar(accounts, contracts, lookaheadDays = 120) {
  const end = NOW + lookaheadDays * DAY;
  const calendar = [];

  for (const a of accounts) {
    if (a.health === "churned") continue;
    const contract = contracts[a.id];
    if (!contract || !contract.renewal_date) continue;
    if (contract.renewal_date > end || contract.renewal_date < NOW - 30 * DAY) continue;

    const daysUntil = Math.round((contract.renewal_date - NOW) / DAY);
    calendar.push({
      account_id: a.id,
      account_name: a.name,
      plan: a.plan,
      mrr: a.mrr,
      health: a.health,
      renewal_date: contract.renewal_date,
      days_until_renewal: daysUntil,
      cs_owner: contract.cs_owner || "unassigned",
      auto_renew: contract.auto_renew || false,
      discount_pct: contract.discount_pct || 0,
      success_plan_pct: contract.success_plan_pct || 0,
    });
  }

  calendar.sort((a, b) => a.renewal_date - b.renewal_date);
  return calendar;
}

export function calendarSummary(calendar, probabilityMap) {
  // probabilityMap: account_id -> forecast probability
  const now30 = calendar.filter(c => c.days_until_renewal <= 30);
  const now60 = calendar.filter(c => c.days_until_renewal <= 60);
  const now90 = calendar.filter(c => c.days_until_renewal <= 90);
  const now120 = calendar;

  const totalMRR = calendar.reduce((s, c) => s + c.mrr, 0) * 12;

  function expectedARR(slice) {
    return slice.reduce((sum, c) => {
      const prob = (probabilityMap && probabilityMap[c.account_id]) || 0.85;
      return sum + c.mrr * 12 * prob;
    }, 0);
  }

  return {
    total_upcoming: calendar.length,
    total_current_arr: totalMRR,
    next_30_days: { count: now30.length, mrr: now30.reduce((s, c) => s + c.mrr, 0), expected_arr: expectedARR(now30) },
    next_60_days: { count: now60.length, mrr: now60.reduce((s, c) => s + c.mrr, 0), expected_arr: expectedARR(now60) },
    next_90_days: { count: now90.length, mrr: now90.reduce((s, c) => s + c.mrr, 0), expected_arr: expectedARR(now90) },
    next_120_days: { count: now120.length, mrr: now120.reduce((s, c) => s + c.mrr, 0), expected_arr: expectedARR(now120) },
    at_risk_count: calendar.filter(c => c.health === "at_risk").length,
    at_risk_arr: calendar.filter(c => c.health === "at_risk").reduce((s, c) => s + c.mrr * 12, 0),
    healthy_count: calendar.filter(c => c.health === "healthy").length,
  };
}

export function interventionQueue(calendar, healthScores, engagementScores, probabilityMap) {
  // Accounts needing intervention: at-risk OR low renewal probability
  return calendar
    .filter(c => {
      const hs = (healthScores && healthScores[c.account_id]) || { score: 100 };
      const prob = (probabilityMap && probabilityMap[c.account_id]) || 1;
      return c.health === "at_risk" || hs.score < 60 || prob < 0.7;
    })
    .map(c => {
      const hs = (healthScores && healthScores[c.account_id]) || { score: 100 };
      const prob = (probabilityMap && probabilityMap[c.account_id]) || 1;
      return {
        ...c,
        health_score: hs.score,
        renewal_probability: prob,
        risk_reason: c.health === "at_risk"
          ? "Account at-risk"
          : hs.score < 60
            ? "Low health score"
            : prob < 0.7
              ? "Low renewal probability"
              : "Monitor",
      };
    })
    .sort((a, b) => a.days_until_renewal - b.days_until_renewal);
}

export function probabilityBands(calendar, probabilityMap) {
  const bands = { high: [], medium: [], low: [], unknown: [] };
  for (const c of calendar) {
    const prob = (probabilityMap && probabilityMap[c.account_id]);
    if (prob == null) bands.unknown.push(c);
    else if (prob >= 0.85) bands.high.push(c);
    else if (prob >= 0.60) bands.medium.push(c);
    else bands.low.push(c);
  }
  return {
    bands,
    high_count: bands.high.length,
    medium_count: bands.medium.length,
    low_count: bands.low.length,
    high_arr: bands.high.reduce((s, c) => s + c.mrr * 12, 0),
    medium_arr: bands.medium.reduce((s, c) => s + c.mrr * 12, 0),
    low_arr: bands.low.reduce((s, c) => s + c.mrr * 12, 0),
  };
}
