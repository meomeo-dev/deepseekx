// Forecasts renderer — ARR, churn, expansion, support, incidents, deploy, cash, scenarios, narrative.
import { FMT } from "./format.js";
import { projectARR, arrForecastSummary } from "./forecasting/arr-projection.js";
import { projectChurn, churnRiskBySegment } from "./forecasting/churn-forecast.js";
import { projectExpansion } from "./forecasting/expansion-pipeline.js";
import { projectSupportLoad } from "./forecasting/support-staffing.js";
import { projectIncidentRisk } from "./forecasting/incident-risk-forecast.js";
import { projectDeployStability } from "./forecasting/deploy-stability-trend.js";
import { compareScenarios } from "./forecasting/scenario-modeling.js";
import { generateNarrative } from "./forecasting/executive-narrative.js";

export function renderForecasts(store, fixtures, filterState) {
  const allFixtures = { ...fixtures, ...(store.state.fixtures || {}) };
  const accounts = store.state.accounts;
  const tickets = store.state.tickets;
  const incidents = store.state.incidents;
  const deployments = store.state.deployments;
  const revenueEvents = store.state.revenue_events || [];
  const retentionCohorts = store.state.retention_cohorts || [];
  const assumptions = allFixtures.forecastAssumptions || {};
  const quarterlyTargets = allFixtures.quarterlyTargets || {};
  const roadmapBets = allFixtures.roadmapBets || [];
  const executiveNotes = allFixtures.executiveNotes || [];

  // Compute current MRR
  const activeAccounts = accounts.filter(a => a.health !== "churned");
  const currentMRR = activeAccounts.reduce((s, a) => s + a.mrr, 0);
  const monthlyTrend = currentMRR * 0.005;

  // Run forecasts
  const arrProj = projectARR(currentMRR, monthlyTrend, assumptions.base_churn_rate || 0.025,
    assumptions.expansion_rate || 0.018, 12, assumptions);
  const arrSum = arrForecastSummary(arrProj, quarterlyTargets);

  const churnForecast = projectChurn(accounts, retentionCohorts, revenueEvents, assumptions);
  const churnBySegment = churnRiskBySegment(accounts);

  const expansionPipe = projectExpansion(accounts, allFixtures, assumptions);

  const supportLoad = projectSupportLoad(tickets, accounts, assumptions);

  const incidentRisk = projectIncidentRisk(incidents, deployments, assumptions);

  const deployStab = projectDeployStability(deployments, allFixtures.deployChecks || {}, assumptions);

  const scenarios = compareScenarios({
    currentMRR, churnRate: assumptions.base_churn_rate || 0.025,
    expansionRate: assumptions.expansion_rate || 0.018,
    organicGrowth: monthlyTrend, monthsAhead: 12,
  }, 12);

  const narrative = generateNarrative(arrSum, churnForecast, expansionPipe, incidentRisk, deployStab, scenarios);

  // ---- HTML ----
  let html = "";

  // KPI cards
  html += `
    <div class="card-grid">
      <div class="card"><div class="card-label">Current ARR</div><div class="card-value">${FMT.currency(arrSum.current_arr)}</div></div>
      <div class="card"><div class="card-label">Projected ARR (12m)</div><div class="card-value ${arrSum.growth_rate_12m >= 0 ? 'green' : 'red'}">${FMT.currency(arrSum.projected_arr_12m)}</div><div class="card-change ${arrSum.growth_rate_12m >= 0 ? 'up' : 'down'}">${arrSum.growth_rate_12m >= 0 ? '+' : ''}${arrSum.growth_rate_12m}%</div></div>
      <div class="card"><div class="card-label">Churn Risk (12m ARR)</div><div class="card-value red">${FMT.currency(churnForecast.total_12m_churn_arr)}</div></div>
      <div class="card"><div class="card-label">Expansion Pipeline</div><div class="card-value green">${FMT.currency(expansionPipe.total_12m_expansion_arr)}</div></div>
      <div class="card"><div class="card-label">Net Retention</div><div class="card-value ${expansionPipe.total_12m_expansion_arr > churnForecast.total_12m_churn_arr ? 'green' : 'amber'}">${FMT.currency(expansionPipe.total_12m_expansion_arr - churnForecast.total_12m_churn_arr)}</div></div>
      <div class="card"><div class="card-label">Support Load (12m)</div><div class="card-value">${supportLoad.total_12m_tickets}</div></div>
      <div class="card"><div class="card-label">Sev0/1 (12m est.)</div><div class="card-value red">${incidentRisk.total_12m_sev0_estimated + incidentRisk.total_12m_sev1_estimated}</div></div>
      <div class="card"><div class="card-label">Deploy Success</div><div class="card-value ${deployStab.current_success_rate >= 90 ? 'green' : deployStab.current_success_rate >= 80 ? 'amber' : 'red'}">${deployStab.current_success_rate}%</div></div>
    </div>
  `;

  // ---- Executive Narrative ----
  html += `
    <div class="panel" style="border-left:3px solid ${narrative.overall_signal === 'positive' ? 'var(--green)' : narrative.overall_signal === 'mixed' ? 'var(--amber)' : 'var(--red)'}">
      <h3>Executive Summary</h3>
      <p style="font-size:14px;margin-bottom:12px">${narrative.overall_summary}</p>
      ${narrative.sections.map(s => `
        <div style="margin-bottom:10px;padding:6px 0;border-bottom:1px solid var(--border)">
          <strong style="color:${s.signal === 'positive' ? 'var(--green)' : s.signal === 'negative' ? 'var(--red)' : 'var(--text-dim)'}">${s.heading}</strong>
          <p style="font-size:12px;color:var(--text-dim);margin-top:2px">${s.body}</p>
        </div>
      `).join("")}
    </div>
  `;

  // ---- ARR Projection + Scenario Comparison ----
  html += `<div class="two-col">`;

  html += `
    <div class="panel">
      <h3>ARR Trajectory</h3>
      ${arrProj.map(p => `
        <div class="bar-row">
          <span class="bar-label">${p.date}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, p.projected_arr / arrSum.projected_arr_12m * 100).toFixed(0)}%;background:var(--accent)"></div></div>
          <span class="bar-val bar-val-mono">${FMT.currency(p.projected_arr)}</span>
        </div>
      `).join("")}
    </div>
  `;

  html += `
    <div class="panel">
      <h3>Scenario Comparison</h3>
      <div style="font-size:11px;color:var(--text-dim);margin-bottom:8px">12-month ARR projection under 4 scenarios</div>
      ${Object.entries(scenarios.scenarios).map(([key, s]) => `
        <div class="bar-row">
          <span class="bar-label">${s.scenario}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, s.terminal_arr / scenarios.scenarios.optimistic.terminal_arr * 100).toFixed(0)}%;background:${getScenarioColor(key)}"></div></div>
          <span class="bar-val bar-val-mono">${FMT.currency(s.terminal_arr)}</span>
        </div>
      `).join("")}
      <div style="margin-top:8px;font-size:11px">
        <span style="color:var(--text-dim)">Spread: </span><strong>${FMT.currency(scenarios.spread)}</strong>
        <span style="color:var(--text-dim);margin-left:12px">Upside: </span><strong style="color:var(--green)">+${FMT.currency(scenarios.upside_potential)}</strong>
        <span style="color:var(--text-dim);margin-left:12px">Downside: </span><strong style="color:var(--red)">-${FMT.currency(scenarios.downside_risk)}</strong>
      </div>
    </div>
  `;

  html += `</div>`;

  // ---- Churn Forecast + Expansion Pipeline ----
  html += `<div class="two-col">`;

  html += `
    <div class="panel">
      <h3>Churn Forecast</h3>
      <div class="table-wrap">
        <table><thead><tr><th>Plan</th><th>At Risk %</th><th>Risk-Weighted ARR</th></tr></thead><tbody>
        ${churnBySegment.map(s => `
          <tr><td>${s.plan}</td><td style="color:${s.at_risk_pct > 20 ? 'var(--red)' : s.at_risk_pct > 10 ? 'var(--amber)' : 'var(--green)'}">${s.at_risk_pct}%</td><td>${FMT.currency(s.risk_weighted_arr)}</td></tr>
        `).join("")}
        </tbody></table>
      </div>
      <div style="margin-top:10px;font-size:12px;color:var(--text-dim)">
        Peak churn month: ${churnForecast.peak_churn_month} · Est. accounts lost: ${churnForecast.total_12m_churn_accounts_estimated}
      </div>
    </div>
  `;

  html += `
    <div class="panel">
      <h3>Expansion Pipeline</h3>
      <div style="font-size:11px;color:var(--text-dim);margin-bottom:8px">Pipeline stages over next 12 months</div>
      <div class="bar-row"><span class="bar-label">Stage 1</span><div class="bar-track"><div class="bar-fill" style="width:100%;background:var(--text-muted)"></div></div><span class="bar-val">${expansionPipe.pipeline[0].stage_1_count}</span></div>
      <div class="bar-row"><span class="bar-label">Stage 2</span><div class="bar-track"><div class="bar-fill" style="width:${pct(expansionPipe.pipeline[0].stage_2_count, expansionPipe.pipeline[0].stage_1_count)}%;background:var(--accent)"></div></div><span class="bar-val">${expansionPipe.pipeline[0].stage_2_count}</span></div>
      <div class="bar-row"><span class="bar-label">Stage 3</span><div class="bar-track"><div class="bar-fill" style="width:${pct(expansionPipe.pipeline[0].stage_3_count, expansionPipe.pipeline[0].stage_1_count)}%;background:var(--green)"></div></div><span class="bar-val">${expansionPipe.pipeline[0].stage_3_count}</span></div>
      <div style="margin-top:8px;font-size:12px;color:var(--text-dim)">
        Projected: ${FMT.currency(expansionPipe.total_12m_expansion_arr)} · Monthly avg: ${FMT.currency(expansionPipe.avg_monthly_expansion)}
      </div>
    </div>
  `;

  html += `</div>`;

  // ---- Support Load + Incident Risk ----
  html += `<div class="two-col">`;

  html += `
    <div class="panel">
      <h3>Support Load Forecast</h3>
      ${supportLoad.monthly.slice(0, 6).map(s => `
        <div class="bar-row">
          <span class="bar-label">${s.date}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, s.projected_tickets / supportLoad.peak_agents_needed * 150 * 100 / (supportLoad.peak_agents_needed * 150)).toFixed(0)}%;background:var(--amber)"></div></div>
          <span class="bar-val">${s.projected_tickets}</span>
        </div>
      `).join("")}
      <div style="margin-top:8px;font-size:12px;color:var(--text-dim)">
        Peak agents needed: ${supportLoad.peak_agents_needed} · Hiring needed: ${supportLoad.total_hiring_needed}
      </div>
    </div>
  `;

  html += `
    <div class="panel">
      <h3>Incident Risk Forecast</h3>
      <div class="table-wrap">
        <table><thead><tr><th>Month</th><th>Incidents</th><th>Sev0/1</th><th>Risk</th></tr></thead><tbody>
        ${incidentRisk.monthly.slice(0, 6).map(i => `
          <tr><td>${i.date}</td><td>${i.projected_incidents}</td>
          <td style="color:var(--red)">${i.estimated_sev0 + i.estimated_sev1}</td>
          <td><span class="tag ${i.risk_level === 'elevated' ? 'tag-sev0' : i.risk_level === 'moderate' ? 'tag-at-risk' : 'tag-healthy'}">${i.risk_level}</span></td></tr>
        `).join("")}
        </tbody></table>
      </div>
    </div>
  `;

  html += `</div>`;

  // ---- Deploy Stability + Roadmap Bets ----
  html += `<div class="two-col">`;

  html += `
    <div class="panel">
      <h3>Deployment Stability Trend</h3>
      <div class="table-wrap">
        <table><thead><tr><th>Month</th><th>Success</th><th>Risk</th><th>Rollbacks</th></tr></thead><tbody>
        ${deployStab.historical.slice(-6).map(h => `
          <tr><td>${h.month}</td><td style="color:${h.success_rate >= 90 ? 'var(--green)' : 'var(--amber)'}">${h.success_rate}%</td>
          <td style="color:${h.avg_risk >= 7 ? 'var(--red)' : h.avg_risk >= 5 ? 'var(--amber)' : 'var(--green)'}">${h.avg_risk}</td>
          <td style="color:${h.rollbacks > 0 ? 'var(--red)' : 'var(--text-dim)'}">${h.rollbacks}</td></tr>
        `).join("")}
        </tbody></table>
      </div>
      <div style="margin-top:8px;font-size:12px;color:var(--text-dim)">
        Risk trend: <strong>${deployStab.risk_trend_direction}</strong> · 12m projected rollbacks: ${deployStab.projected_rollbacks_12m}
      </div>
    </div>
  `;

  html += `
    <div class="panel">
      <h3>Roadmap Bets</h3>
      <div class="table-wrap">
        <table><thead><tr><th>Initiative</th><th>ARR Impact</th><th>Prob.</th><th>ETA</th><th>Expected</th></tr></thead><tbody>
        ${roadmapBets.map(b => `
          <tr><td>${b.name}</td><td>${FMT.currency(b.est_arr_impact)}</td>
          <td>${(b.probability * 100).toFixed(0)}%</td><td>${b.eta_months}m</td>
          <td style="font-weight:600">${FMT.currency(Math.round(b.est_arr_impact * b.probability))}</td></tr>
        `).join("")}
        </tbody></table>
      </div>
    </div>
  `;

  html += `</div>`;

  document.getElementById("forecasts-content").innerHTML = html;
}

function getScenarioColor(key) {
  return { baseline: "var(--accent)", optimistic: "var(--green)", conservative: "var(--amber)", downside: "var(--red)" }[key] || "var(--accent)";
}
function pct(a, b) { return b > 0 ? Math.min(100, (a / b * 100)).toFixed(0) : 0; }
