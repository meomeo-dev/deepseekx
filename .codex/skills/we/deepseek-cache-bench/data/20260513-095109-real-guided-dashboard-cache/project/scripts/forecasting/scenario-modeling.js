// Scenario modeling — what-if projections under different assumptions.

export function buildScenarios(baseParams) {
  const { currentMRR, churnRate, expansionRate, organicGrowth, monthsAhead } = baseParams;

  return {
    baseline: {
      label: "Baseline",
      description: "Current trends continue",
      churn_mult: 1.0,
      expansion_mult: 1.0,
      growth_mult: 1.0,
      color: "var(--accent)",
    },
    optimistic: {
      label: "Optimistic",
      description: "Strong expansion, lower churn",
      churn_mult: 0.7,
      expansion_mult: 1.4,
      growth_mult: 1.2,
      color: "var(--green)",
    },
    conservative: {
      label: "Conservative",
      description: "Higher churn, muted expansion",
      churn_mult: 1.5,
      expansion_mult: 0.7,
      growth_mult: 0.8,
      color: "var(--amber)",
    },
    downside: {
      label: "Downside Risk",
      description: "Recession-level churn, stalled expansion",
      churn_mult: 2.5,
      expansion_mult: 0.3,
      growth_mult: 0.4,
      color: "var(--red)",
    },
  };
}

export function runScenario(params, scenario, monthsAhead) {
  const MONTH = 30 * 86400000;
  let mrr = params.currentMRR;
  const projections = [];

  for (let m = 0; m < monthsAhead; m++) {
    const churnLoss = mrr * (params.churnRate * scenario.churn_mult / 12);
    const expansionGain = mrr * (params.expansionRate * scenario.expansion_mult / 12);
    const organic = params.organicGrowth * scenario.growth_mult;

    mrr = mrr - churnLoss + expansionGain + organic;
    if (mrr < 0) mrr = 0;

    projections.push({
      month: m + 1,
      date: new Date(Date.now() + m * MONTH).toISOString().slice(0, 7),
      projected_arr: Math.round(mrr * 12),
    });
  }

  return {
    scenario: scenario.label,
    terminal_arr: projections[projections.length - 1].projected_arr,
    growth_12m: projections[0].projected_arr > 0
      ? parseFloat(((projections[projections.length - 1].projected_arr / projections[0].projected_arr - 1) * 100).toFixed(1))
      : 0,
    projections,
  };
}

export function compareScenarios(params, monthsAhead) {
  const scenarios = buildScenarios(params);
  const results = {};
  for (const [key, scenario] of Object.entries(scenarios)) {
    results[key] = runScenario(params, scenario, monthsAhead);
  }
  return {
    scenarios: results,
    spread: results.optimistic.terminal_arr - results.downside.terminal_arr,
    baseline_arr: results.baseline.terminal_arr,
    upside_potential: results.optimistic.terminal_arr - results.baseline.terminal_arr,
    downside_risk: results.baseline.terminal_arr - results.downside.terminal_arr,
  };
}
