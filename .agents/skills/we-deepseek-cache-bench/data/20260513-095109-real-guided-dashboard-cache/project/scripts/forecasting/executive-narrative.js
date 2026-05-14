// Executive narrative generation — produces a plain-English summary of forecasts.

export function generateNarrative(arrForecast, churnForecast, expansionPipeline, incidentForecast, deployStability, scenarioResults) {
  const sections = [];

  // ARR headline
  const arrGrowth = arrForecast.growth_rate_12m;
  sections.push({
    heading: "ARR Outlook",
    body: `ARR is projected to ${arrGrowth >= 0 ? "grow" : "decline"} by ${Math.abs(arrGrowth)}% over the next 12 months, ` +
      `reaching ${formatCurrency(arrForecast.projected_arr_12m)} from ${formatCurrency(arrForecast.current_arr)}. ` +
      `Net monthly change averages ${formatCurrency(Math.round(arrForecast.total_net_change / 12))}.`,
    signal: arrGrowth >= 10 ? "positive" : arrGrowth >= 0 ? "neutral" : "negative",
  });

  // Churn risk
  const churnArr = churnForecast.total_12m_churn_arr;
  sections.push({
    heading: "Churn Risk",
    body: `Projected churn over 12 months is ${formatCurrency(churnArr)} in ARR ` +
      `(approximately ${churnForecast.total_12m_churn_accounts_estimated} accounts). ` +
      `Peak churn month is projected to be month ${churnForecast.peak_churn_month}. ` +
      `${churnArr > arrForecast.current_arr * 0.05 ? "Churn exceeds 5% of current ARR — retention investment recommended." : "Churn is within acceptable range."}`,
    signal: churnArr > arrForecast.current_arr * 0.08 ? "negative" : churnArr > arrForecast.current_arr * 0.04 ? "neutral" : "positive",
  });

  // Expansion
  const expArr = expansionPipeline.total_12m_expansion_arr;
  sections.push({
    heading: "Expansion Pipeline",
    body: `Expansion revenue is projected at ${formatCurrency(expArr)} over 12 months, ` +
      `averaging ${formatCurrency(expansionPipeline.avg_monthly_expansion)} per month. ` +
      `Peak expansion month: ${expansionPipeline.peak_month}. ` +
      `${expArr > churnArr ? "Expansion revenue exceeds projected churn — net positive." : "Expansion does not fully offset churn — net negative."}`,
    signal: expArr > churnArr ? "positive" : "neutral",
  });

  // Incident risk
  const sev0_1 = incidentForecast.total_12m_sev0_estimated + incidentForecast.total_12m_sev1_estimated;
  sections.push({
    heading: "Incident Risk",
    body: `Projected ${incidentForecast.avg_monthly_incidents} incidents/month average, ` +
      `with approximately ${sev0_1} sev0/sev1 incidents over 12 months. ` +
      `Risk trend: ${incidentForecast.risk_trend}. ` +
      `${incidentForecast.risk_trend === "elevated" ? "Incident risk is elevated — consider increasing on-call rotation and investing in reliability." : "Incident risk is within normal parameters."}`,
    signal: incidentForecast.risk_trend === "elevated" ? "negative" : incidentForecast.risk_trend === "moderate" ? "neutral" : "positive",
  });

  // Deploy stability
  sections.push({
    heading: "Deployment Health",
    body: `Deployment success rate is ${deployStability.current_success_rate}% with an average risk score of ${deployStability.current_avg_risk}/10. ` +
      `Risk trend is ${deployStability.risk_trend_direction}. ` +
      `Projected rollbacks over 12 months: ${deployStability.projected_rollbacks_12m}. ` +
      `${deployStability.risk_trend_direction === "worsening" ? "Deploy risk is trending upward — review pre-deploy check coverage." : deployStability.risk_trend_direction === "improving" ? "Deploy risk is trending downward — process improvements are working." : "Deploy risk is stable."}`,
    signal: deployStability.risk_trend_direction === "worsening" ? "negative" : deployStability.risk_trend_direction === "improving" ? "positive" : "neutral",
  });

  // Scenarios
  if (scenarioResults) {
    sections.push({
      heading: "Scenario Range",
      body: `Baseline 12-month ARR: ${formatCurrency(scenarioResults.baseline_arr)}. ` +
        `Optimistic upside: +${formatCurrency(scenarioResults.upside_potential)} (${formatCurrency(scenarioResults.scenarios.optimistic.terminal_arr)}). ` +
        `Downside risk: -${formatCurrency(scenarioResults.downside_risk)} (${formatCurrency(scenarioResults.scenarios.downside.terminal_arr)}). ` +
        `Spread between optimistic and downside: ${formatCurrency(scenarioResults.spread)}.`,
      signal: scenarioResults.upside_potential > scenarioResults.downside_risk ? "positive" : "neutral",
    });
  }

  // Overall assessment
  const signals = sections.map(s => s.signal);
  const positiveCount = signals.filter(s => s === "positive").length;
  const negativeCount = signals.filter(s => s === "negative").length;
  const overallSignal = negativeCount > positiveCount ? "caution" : negativeCount > 0 ? "mixed" : "positive";

  return {
    sections,
    overall_signal: overallSignal,
    overall_summary: overallSignal === "positive"
      ? "Overall outlook is positive. Key indicators are trending favorably."
      : overallSignal === "mixed"
        ? "Outlook is mixed. Some areas require attention while others are on track."
        : "Outlook calls for caution. Several indicators signal risk that needs executive attention.",
    generated_at: Date.now(),
  };
}

function formatCurrency(n) {
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}
