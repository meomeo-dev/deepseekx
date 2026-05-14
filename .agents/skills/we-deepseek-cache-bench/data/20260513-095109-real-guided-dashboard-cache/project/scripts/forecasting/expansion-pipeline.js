// Expansion pipeline forecast — projects upsell/cross-sell revenue.

const DAY = 86400000;
const MONTH = 30 * DAY;

export function projectExpansion(accounts, fixtures, assumptions) {
  const expansionSignals = fixtures.expansionSignals || [];
  const adoption = fixtures.featureAdoption || {};
  const now = Date.now();

  // Stage signals by recency and weight
  const staged = { stage_1_identified: [], stage_2_engaged: [], stage_3_committed: [] };

  for (const sig of expansionSignals) {
    const ageDays = (now - sig.timestamp) / DAY;
    if (ageDays <= 30) staged.stage_1_identified.push(sig);
    else if (ageDays <= 60) staged.stage_2_engaged.push(sig);
    else staged.stage_3_committed.push(sig);
  }

  // Stage conversion rates
  const rates = assumptions?.expansion_conversion || {
    stage_1_to_2: 0.30,
    stage_2_to_3: 0.40,
    stage_3_to_close: 0.55,
  };

  const monthlyCloseRate = rates.stage_3_to_close / 3;

  // Estimate deal values
  function estimateDealValue(accountId) {
    const account = accounts.find(a => a.id === accountId);
    if (!account) return 2000;
    const planMultiplier = { Starter: 0.5, Growth: 0.35, Business: 0.25, Enterprise: 0.15 };
    return Math.round(account.mrr * (planMultiplier[account.plan] || 0.3));
  }

  const pipeline = [];
  for (let m = 0; m < 12; m++) {
    // Advance pipeline stages
    const newStage2 = staged.stage_1_identified.length * rates.stage_1_to_2 / 6;
    const newStage3 = staged.stage_2_engaged.length * rates.stage_2_to_3 / 3;
    const closed = staged.stage_3_committed.length * monthlyCloseRate;

    const closedValue = staged.stage_3_committed.reduce((s, sig) => s + estimateDealValue(sig.account_id) * monthlyCloseRate / staged.stage_3_committed.length, 0);

    pipeline.push({
      month: m + 1,
      date: new Date(now + m * MONTH).toISOString().slice(0, 7),
      stage_1_count: staged.stage_1_identified.length,
      stage_2_count: staged.stage_2_engaged.length,
      stage_3_count: staged.stage_3_committed.length,
      deals_closed: parseFloat(closed.toFixed(1)),
      expansion_mrr: Math.round(closedValue),
      expansion_arr: Math.round(closedValue * 12),
    });

    // Shuffle for next month (simplified)
    staged.stage_1_identified = staged.stage_1_identified.slice(Math.floor(newStage2));
    staged.stage_2_engaged = staged.stage_2_engaged.slice(Math.floor(newStage3));
    staged.stage_3_committed = staged.stage_3_committed.slice(Math.floor(closed));
  }

  const totalExpansion = pipeline.reduce((s, p) => s + p.expansion_arr, 0);

  return {
    pipeline,
    total_12m_expansion_arr: totalExpansion,
    avg_monthly_expansion: Math.round(totalExpansion / 12),
    peak_month: pipeline.reduce((best, p) => p.expansion_mrr > best.expansion_mrr ? p : best, pipeline[0]).month,
  };
}
