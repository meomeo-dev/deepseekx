// Usage Ops renderer — feature adoption, seats, cohorts, onboarding, PQA, blockers, anomalies, playbooks.
import { FMT } from "./format.js";
import { batchScoreAdoption, adoptionSummary } from "./usage/feature-adoption-scoring.js";
import { batchAnalyzeSeats, seatUtilizationSummary } from "./usage/seat-utilization.js";
import { cohortByUsageLevel, batchDetectTrends, trendSummary } from "./usage/usage-cohorting.js";
import { batchTrackOnboarding, onboardingSummary } from "./usage/onboarding-tracking.js";
import { batchDetectPQA, pqaSummary } from "./usage/pqa-detection.js";
import { batchDetectBlockers, blockerSummary } from "./usage/adoption-blockers.js";
import { triageAnomalies, anomalyTriageSummary } from "./usage/anomaly-triage.js";
import { recommendPlaybooks, playbookSummary } from "./usage/adoption-playbooks.js";

export function renderUsage(store, fixtures, filterState) {
  const allFixtures = { ...fixtures, ...(store.state.fixtures || {}) };
  const accounts = store.state.accounts;
  const activeAccounts = accounts.filter(a => a.health !== "churned");
  const featureCatalog = allFixtures.featureCatalog || [];
  const featureAdoption = allFixtures.featureAdoptionDetail || {};
  const seatActivity = allFixtures.seatActivity || {};
  const onboardingEvents = allFixtures.onboardingEvents || [];
  const usageEvents = allFixtures.usageEvents || [];
  const expansionSignals = allFixtures.expansionSignals || [];
  const anomalies = allFixtures.usageAnomalies || [];
  const trainingSessions = allFixtures.trainingSessions || [];
  const tickets = store.state.tickets;
  const npsResponses = allFixtures.npsResponses || [];

  // Run all analyses
  const adoptionScores = batchScoreAdoption(activeAccounts, featureAdoption, featureCatalog);
  const adSum = adoptionSummary(adoptionScores);
  const seatAnalysis = batchAnalyzeSeats(activeAccounts, seatActivity);
  const seatSum = seatUtilizationSummary(seatAnalysis);
  const usageCohorts = cohortByUsageLevel(activeAccounts, usageEvents);
  const trends = batchDetectTrends(activeAccounts, usageEvents);
  const trendSum = trendSummary(trends);
  const onboarding = batchTrackOnboarding(activeAccounts, onboardingEvents);
  const onbSum = onboardingSummary(onboarding);
  const pqa = batchDetectPQA(activeAccounts, usageEvents, featureAdoption, expansionSignals);
  const pqaSum = pqaSummary(pqa);
  const blockers = batchDetectBlockers(activeAccounts, featureAdoption, onboarding, tickets, npsResponses, trainingSessions);
  const blkSum = blockerSummary(blockers);
  const anomalyTriage = triageAnomalies(anomalies, accounts, usageEvents);
  const anomSum = anomalyTriageSummary(anomalyTriage);

  // Playbooks for top adoption gap accounts
  const gapContexts = {};
  for (const s of adoptionScores.filter(s => s.level === "minimal" || s.level === "light").slice(0, 15)) {
    const a = accounts.find(ac => ac.id === s.account_id);
    const seat = seatAnalysis.find(sa => sa.account_id === s.account_id);
    gapContexts[s.account_id] = recommendPlaybooks({
      adoptionScore: s.overall_score, adoptionLevel: s.level,
      unusedFeatures: s.unused_count, featureDepth: s.depth_score,
      mrr: a?.mrr || 0, health: a?.health || "healthy",
      seatUtilization: seat?.utilization_pct || 50,
      onboardingStuck: onboarding.find(o => o.account_id === s.account_id)?.stuck || false,
      progressPct: onboarding.find(o => o.account_id === s.account_id)?.progress_pct || 0,
      usageLevel: s.level === "minimal" ? "dormant" : "light",
    });
  }
  const playSum = playbookSummary(gapContexts);

  // ---- HTML ----
  let html = "";

  html += `
    <div class="card-grid">
      <div class="card"><div class="card-label">Adoption Score (avg)</div><div class="card-value ${adSum.avg_score >= 55 ? 'green' : 'amber'}">${adSum.avg_score}</div></div>
      <div class="card"><div class="card-label">Power Users</div><div class="card-value green">${adSum.power_users}</div></div>
      <div class="card"><div class="card-label">Adoption Gap</div><div class="card-value amber">${adSum.adoption_gap}</div></div>
      <div class="card"><div class="card-label">Inactive Seats</div><div class="card-value red">${seatSum.total_inactive_seats}</div></div>
      <div class="card"><div class="card-label">Stuck Onboarding</div><div class="card-value red">${onbSum.stuck}</div></div>
      <div class="card"><div class="card-label">PQA Qualified</div><div class="card-value green">${pqaSum.qualified}</div></div>
      <div class="card"><div class="card-label">Adoption Blockers</div><div class="card-value amber">${blkSum.total_blockers}</div></div>
      <div class="card"><div class="card-label">Usage Anomalies</div><div class="card-value ${anomSum.total > 0 ? 'red' : 'green'}">${anomSum.unresolved}</div></div>
    </div>
  `;

  // Two-col: Adoption Scores + Usage Cohorts
  html += `<div class="two-col">`;

  html += `
    <div class="panel">
      <h3>Feature Adoption</h3>
      <div class="metric-row" style="margin-bottom:8px">
        <div class="metric-item"><span class="metric-label">Power</span><span class="metric-value" style="color:var(--green)">${adSum.byLevel.power_user || 0}</span></div>
        <div class="metric-item"><span class="metric-label">Engaged</span><span class="metric-value" style="color:var(--accent)">${adSum.byLevel.engaged || 0}</span></div>
        <div class="metric-item"><span class="metric-label">Light</span><span class="metric-value" style="color:var(--amber)">${adSum.byLevel.light || 0}</span></div>
        <div class="metric-item"><span class="metric-label">Minimal</span><span class="metric-value" style="color:var(--red)">${adSum.byLevel.minimal || 0}</span></div>
      </div>
      <div class="table-wrap"><table><thead><tr><th>Account</th><th>Score</th><th>Breadth</th><th>Depth</th><th>Unused</th></tr></thead><tbody>
      ${adoptionScores.slice(0, 8).map(s => `
        <tr class="usage-row" data-account-id="${s.account_id}" style="cursor:pointer">
          <td>${s.account_name}</td><td><strong>${s.overall_score}</strong></td>
          <td>${s.breadth_score}</td><td>${s.depth_score}</td>
          <td style="color:var(--amber)">${s.unused_count}</td></tr>
      `).join("")}</tbody></table></div>
    </div>
  `;

  html += `
    <div class="panel">
      <h3>Usage Cohorts</h3>
      <div class="bar-row"><span class="bar-label">Heavy</span><div class="bar-track"><div class="bar-fill" style="width:${pct(usageCohorts.heavy.count, activeAccounts.length)}%;background:var(--green)"></div></div><span class="bar-val">${usageCohorts.heavy.count}</span></div>
      <div class="bar-row"><span class="bar-label">Moderate</span><div class="bar-track"><div class="bar-fill" style="width:${pct(usageCohorts.moderate.count, activeAccounts.length)}%;background:var(--accent)"></div></div><span class="bar-val">${usageCohorts.moderate.count}</span></div>
      <div class="bar-row"><span class="bar-label">Light</span><div class="bar-track"><div class="bar-fill" style="width:${pct(usageCohorts.light.count, activeAccounts.length)}%;background:var(--amber)"></div></div><span class="bar-val">${usageCohorts.light.count}</span></div>
      <div class="bar-row"><span class="bar-label">Dormant</span><div class="bar-track"><div class="bar-fill" style="width:${pct(usageCohorts.dormant.count, activeAccounts.length)}%;background:var(--red)"></div></div><span class="bar-val">${usageCohorts.dormant.count}</span></div>
      <div style="margin-top:8px"><span style="font-size:12px;color:var(--text-dim)">Growing: ${trendSum.growing} · Stable: ${trendSum.stable} · Declining: <span style="color:var(--red)">${trendSum.declining}</span></span></div>
    </div>
  `;

  html += `</div>`;

  // Two-col: Seats + Onboarding
  html += `<div class="two-col">`;

  html += `
    <div class="panel">
      <h3>Seat Utilization</h3>
      <div class="metric-row" style="margin-bottom:8px">
        <div class="metric-item"><span class="metric-label">Healthy</span><span class="metric-value" style="color:var(--green)">${seatSum.healthy}</span></div>
        <div class="metric-item"><span class="metric-label">Underutilized</span><span class="metric-value" style="color:var(--amber)">${seatSum.underutilized}</span></div>
        <div class="metric-item"><span class="metric-label">Critical</span><span class="metric-value" style="color:var(--red)">${seatSum.critical}</span></div>
        <div class="metric-item"><span class="metric-label">Savings</span><span class="metric-value">${FMT.currency(seatSum.total_potential_savings_mrr)}/mo</span></div>
      </div>
      <div class="table-wrap"><table><thead><tr><th>Account</th><th>Active/Total</th><th>Util%</th><th>Excess</th></tr></thead><tbody>
      ${seatAnalysis.filter(s => s.status === "critical" || s.status === "underutilized").slice(0, 6).map(s => `
        <tr class="usage-row" data-account-id="${s.account_id}" style="cursor:pointer">
          <td>${s.account_name}</td><td>${s.active_seats}/${s.total_seats}</td>
          <td style="color:${s.utilization_pct < 30 ? 'var(--red)' : 'var(--amber)'}">${s.utilization_pct}%</td>
          <td>${s.excess_seats}</td></tr>
      `).join("")}</tbody></table></div>
    </div>
  `;

  html += `
    <div class="panel">
      <h3>Onboarding Progress</h3>
      <div style="font-size:11px;color:var(--text-dim);margin-bottom:6px">Avg TTV: ${onbSum.avg_ttv_days != null ? onbSum.avg_ttv_days + ' days' : '—'} · Complete: ${onbSum.completed} · Stuck: ${onbSum.stuck}</div>
      <div class="table-wrap"><table><thead><tr><th>Account</th><th>Progress</th><th>TTV</th><th>Overdue</th></tr></thead><tbody>
      ${onboarding.filter(o => o.status !== "complete").slice(0, 6).map(o => `
        <tr class="usage-row" data-account-id="${o.account_id}" style="cursor:pointer">
          <td>${o.account_name}</td>
          <td><div class="bar-row" style="margin:0"><div class="bar-track" style="height:12px"><div class="bar-fill" style="width:${o.progress_pct}%;background:${o.progress_pct >= 60 ? 'var(--green)' : o.progress_pct >= 30 ? 'var(--accent)' : 'var(--amber)'}"></div></div><span class="bar-val">${o.progress_pct}%</span></div></td>
          <td>${o.time_to_value_days != null ? o.time_to_value_days + 'd' : '—'}</td>
          <td style="color:var(--red)">${o.overdue_milestones}</td></tr>
      `).join("")}</tbody></table></div>
    </div>
  `;

  html += `</div>`;

  // PQA + Adoption Blockers
  html += `<div class="two-col">`;

  html += `
    <div class="panel">
      <h3>Product-Qualified Accounts</h3>
      <div class="table-wrap"><table><thead><tr><th>Account</th><th>Score</th><th>Level</th><th>Active Days</th></tr></thead><tbody>
      ${pqa.filter(p => p.pqa_level !== "not_ready").slice(0, 8).map(p => `
        <tr class="usage-row" data-account-id="${p.account_id}" style="cursor:pointer">
          <td>${p.account_name}</td><td><strong>${p.pqa_score}</strong></td>
          <td><span class="tag ${p.pqa_level === 'qualified' ? 'tag-healthy' : 'tag-running'}">${p.pqa_level}</span></td>
          <td>${p.active_days}d/mo</td></tr>
      `).join("")}</tbody></table></div>
    </div>
  `;

  html += `
    <div class="panel">
      <h3>Top Adoption Blockers</h3>
      <div class="table-wrap"><table><thead><tr><th>Type</th><th>Count</th></tr></thead><tbody>
      ${blkSum.byType.slice(0, 6).map(([type, count]) => `
        <tr><td>${type.replace(/_/g, ' ')}</td><td><strong>${count}</strong></td></tr>
      `).join("")}</tbody></table></div>
      <div style="margin-top:8px;font-size:12px;color:var(--text-dim)">
        ${blkSum.critical_accounts} accounts with critical blockers · ${blkSum.total_blockers} total blockers
      </div>
    </div>
  `;

  html += `</div>`;

  // Anomalies + Playbooks
  html += `<div class="two-col">`;

  html += `
    <div class="panel">
      <h3>Usage Anomalies (${anomSum.unresolved} unresolved)</h3>
      <div class="table-wrap"><table><thead><tr><th>Account</th><th>Type</th><th>Priority</th><th>Age</th></tr></thead><tbody>
      ${anomalyTriage.slice(0, 8).map(a => `
        <tr class="usage-row" data-account-id="${a.account_id}" style="cursor:pointer">
          <td>${a.account_name}</td><td>${a.type}</td>
          <td><span class="tag ${a.priority === 'critical' ? 'tag-sev0' : a.priority === 'high' ? 'tag-at-risk' : 'tag-running'}">${a.priority}</span></td>
          <td>${a.days_ago}d</td></tr>
      `).join("")}</tbody></table></div>
    </div>
  `;

  html += `
    <div class="panel">
      <h3>Recommended Adoption Plays</h3>
      ${playSum.top_plays.map(p => `
        <div class="bar-row">
          <span class="bar-label">${p.name}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${pct(p.count, playSum.total_matches)}%;background:var(--accent)"></div></div>
          <span class="bar-val">${p.count}</span>
        </div>
      `).join("")}
      <div style="margin-top:8px;font-size:12px;color:var(--text-dim)">${playSum.accounts_with_plays} accounts with playbook recommendations</div>
    </div>
  `;

  html += `</div>`;

  document.getElementById("usage-content").innerHTML = html;

  document.querySelectorAll(".usage-row").forEach(row => {
    row.addEventListener("click", () => {
      const aid = row.dataset.accountId;
      if (aid) filterState.set("selectedAccountId", aid);
    });
  });
}

function pct(a, b) { return b > 0 ? Math.min(100, (a / b * 100)).toFixed(0) : 0; }
