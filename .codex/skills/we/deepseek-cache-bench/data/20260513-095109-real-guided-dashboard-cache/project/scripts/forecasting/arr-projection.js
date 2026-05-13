// ARR projection — forecasts forward ARR using trends, churn, expansion, seasonality.

const DAY = 86400000;
const MONTH = 30 * DAY;

export function projectARR(currentMRR, monthlyTrend, churnRate, expansionRate, monthsAhead, assumptions) {
  const projections = [];
  let mrr = currentMRR;
  const seasonality = (assumptions && assumptions.seasonality) || {};

  for (let m = 0; m < monthsAhead; m++) {
    const calendarMonth = String(new Date(Date.now() + m * MONTH).getMonth() + 1).padStart(2, "0");
    const seasonalFactor = seasonality[calendarMonth] || 1.0;

    // Apply churn and expansion
    const churnLoss = mrr * (churnRate / 12);
    const expansionGain = mrr * (expansionRate / 12);
    const organicGrowth = monthlyTrend * seasonalFactor;

    mrr = mrr - churnLoss + expansionGain + organicGrowth;
    if (mrr < 0) mrr = 0;

    projections.push({
      month: m + 1,
      date: new Date(Date.now() + m * MONTH).toISOString().slice(0, 7),
      projected_mrr: Math.round(mrr),
      projected_arr: Math.round(mrr * 12),
      churn_loss: Math.round(churnLoss),
      expansion_gain: Math.round(expansionGain),
      organic_growth: Math.round(organicGrowth),
      net_change: Math.round(expansionGain + organicGrowth - churnLoss),
    });
  }

  return projections;
}

export function arrForecastSummary(projections, quarterlyTargets) {
  const last = projections[projections.length - 1];
  const in12Months = projections.length >= 12 ? projections[11] : last;

  const totalNetChange = projections.reduce((s, p) => s + p.net_change, 0);
  const totalChurn = projections.reduce((s, p) => s + p.churn_loss, 0);
  const totalExpansion = projections.reduce((s, p) => s + p.expansion_gain, 0);

  // vs targets
  const vsTarget = {};
  if (quarterlyTargets) {
    for (const [q, target] of Object.entries(quarterlyTargets)) {
      const qMonth = (parseInt(q.replace("Q", "")) - 1) * 3;
      const actual = projections.length > qMonth + 2 ? projections[qMonth + 2].projected_arr : projections[projections.length - 1].projected_arr;
      vsTarget[q] = {
        target,
        projected: actual,
        gap: actual - target,
        on_track: actual >= target * 0.9,
      };
    }
  }

  return {
    current_arr: projections[0].projected_arr,
    projected_arr_12m: in12Months.projected_arr,
    total_net_change: totalNetChange,
    total_churn_loss: totalChurn,
    total_expansion_gain: totalExpansion,
    growth_rate_12m: projections[0].projected_arr > 0
      ? parseFloat(((in12Months.projected_arr / projections[0].projected_arr - 1) * 100).toFixed(1))
      : 0,
    monthly_projections: projections,
    vs_targets: vsTarget,
  };
}
