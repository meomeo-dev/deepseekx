// Portfolio renderer — segmented account list with badges, scoring, and actions.
import { FMT } from "./format.js";
import { segmentAccounts, segmentSummary } from "./portfolio/segmentation.js";
import { recommendActions } from "./portfolio/next-action.js";
import { scoreExpansionOpportunity, topExpansionOpportunities, expansionSummary } from "./portfolio/expansion-scoring.js";

export function renderPortfolio(store, fixtures, filterState) {
  const accounts = store.state.accounts;
  const allFixtures = { ...fixtures, ...(store.state.fixtures || {}) };
  const segments = segmentAccounts(accounts, allFixtures);
  const summary = segmentSummary(segments);

  // Compute scores for all active accounts
  const now = Date.now();
  const DAY = 86400000;

  function buildContext(a) {
    const contract = (allFixtures.contracts || {})[a.id];
    const accountTickets = store.state.tickets.filter(t => t.account_id === a.id);
    const accountUsage = (allFixtures.usageEvents || []).filter(e => e.account_id === a.id);
    const accountNps = (allFixtures.npsResponses || []).filter(n => n.account_id === a.id);
    const stakeholders = (allFixtures.stakeholders || []).filter(s => s.account_id === a.id);

    // Simple health/engagement scores inline
    const openCritical = accountTickets.filter(t => t.status !== "resolved" && (t.priority === "critical" || t.priority === "high")).length;
    const recentUsage = accountUsage.filter(e => e.timestamp > now - 30 * DAY);
    const avgUsage = recentUsage.length ? recentUsage.reduce((s, e) => s + e.value, 0) / recentUsage.length : 0;
    const activeDays = new Set(recentUsage.map(e => new Date(e.timestamp).toDateString())).size;
    const engagementScore = Math.min(100, Math.round(50 + activeDays * 1.5));
    const avgCsat = accountTickets.filter(t => t.satisfaction_score != null).reduce((s, t) => s + t.satisfaction_score, 0)
      / Math.max(1, accountTickets.filter(t => t.satisfaction_score != null).length);

    let healthScore = 70;
    if (a.health === "healthy") healthScore = 70 + (a.name.length * 3 % 20);
    else if (a.health === "at_risk") healthScore = 25 + (a.name.length * 3 % 25);
    else healthScore = 0;

    // Adjust for open tickets
    if (openCritical > 2) healthScore -= 15;
    else if (openCritical > 0) healthScore -= openCritical * 5;
    healthScore = Math.max(0, Math.min(100, healthScore));

    const expansionScore = scoreExpansionOpportunity(a, allFixtures).score;
    const renewalProb = contract?.renewal_date
      ? (a.health === "healthy" ? 0.85 + (healthScore - 70) * 0.003 : a.health === "at_risk" ? 0.55 : 0)
      : null;

    return {
      healthScore,
      engagementScore,
      expansionScore,
      daysUntilRenewal: contract?.renewal_date ? Math.round((contract.renewal_date - now) / DAY) : null,
      openCriticalTickets: openCritical,
      avgCsat,
      successPlanPct: contract?.success_plan_pct,
      featureAdoptionRate: a.feature_adoption,
      hasStakeholders: stakeholders.length > 0,
      healthTrend: a.health === "healthy" ? "stable" : "declining",
      renewalProbability: renewalProb,
      health: a.health,
      mrr: a.mrr,
    };
  }

  const activeAccounts = accounts.filter(a => a.health !== "churned");
  const contexts = {};
  for (const a of activeAccounts) contexts[a.id] = buildContext(a);
  const actions = {};
  for (const a of activeAccounts) actions[a.id] = recommendActions(a, contexts[a.id]);

  // Expansion opportunities
  const topExp = topExpansionOpportunities(activeAccounts, allFixtures, 8);
  const expSum = expansionSummary(topExp);

  // ---- HTML ----
  const csmNames = { "emma.wu": "Emma Wu", "raj.patel": "Raj Patel", "lisa.chen": "Lisa Chen", "omar.jones": "Omar Jones" };

  let html = "";

  // Summary cards
  html += `
    <div class="card-grid">
      <div class="card"><div class="card-label">Total Accounts</div><div class="card-value">${summary.total}</div></div>
      <div class="card"><div class="card-label">Healthy</div><div class="card-value green">${summary.healthy}</div></div>
      <div class="card"><div class="card-label">At Risk</div><div class="card-value amber">${summary.at_risk}</div></div>
      <div class="card"><div class="card-label">Renewal Imminent</div><div class="card-value ${summary.renewal_imminent > 0 ? 'amber' : ''}">${summary.renewal_imminent}</div></div>
      <div class="card"><div class="card-label">Expansion (Strong)</div><div class="card-value green">${expSum.strongCount}</div></div>
      <div class="card"><div class="card-label">Expansion ARR Est.</div><div class="card-value">${FMT.currency(expSum.totalExpansionARR)}</div></div>
    </div>
  `;

  // ---- By CSM Owner ----
  html += `<div class="panel"><h3>Accounts by CSM Owner</h3>`;
  for (const [owner, accts] of Object.entries(segments.by_csm)) {
    if (!accts.length) continue;
    const displayName = csmNames[owner] || owner;
    const atRisk = accts.filter(a => a.health === "at_risk").length;
    const healthy = accts.filter(a => a.health === "healthy").length;
    html += `
      <div class="csm-group" style="margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
          <strong style="font-size:14px">${displayName}</strong>
          <span style="font-size:12px;color:var(--text-dim)">${accts.length} accounts</span>
          <span class="tag tag-healthy">${healthy} healthy</span>
          ${atRisk > 0 ? `<span class="tag tag-at-risk">${atRisk} at risk</span>` : ""}
          <span style="font-size:11px;color:var(--text-muted);margin-left:auto">MRR: ${FMT.currency(accts.reduce((s,a) => s + a.mrr, 0))}</span>
        </div>
        <div class="table-wrap">
          <table class="portfolio-table">
            <thead><tr>
              <th>Account</th><th>Plan</th><th>MRR</th><th>Health</th><th>Eng.</th>
              <th>Risk Factor</th><th>Next Best Action</th><th>Renewal</th>
            </tr></thead>
            <tbody>
            ${accts.map(a => {
              const ctx = contexts[a.id] || {};
              const act = actions[a.id] || [];
              const contract = (allFixtures.contracts || {})[a.id];
              const riskFactor = ctx.healthScore < 50 ? "Low health" :
                ctx.openCriticalTickets > 0 ? `${ctx.openCriticalTickets} critical tickets` :
                ctx.daysUntilRenewal != null && ctx.daysUntilRenewal < 30 ? "Renewal imminent" :
                (ctx.avgCsat < 2.5 && ctx.avgCsat > 0) ? "Low CSAT" : "On track";
              const topAction = act[0] || { label: "Monitor", priority: "low" };
              const actionColor = { critical: "var(--red)", high: "var(--amber)", medium: "var(--accent)", low: "var(--text-dim)" };
              const renewalLabel = contract?.renewal_date
                ? `${Math.round((contract.renewal_date - now) / DAY)}d`
                : "—";
              return `
                <tr class="portfolio-row" data-account-id="${a.id}" style="cursor:pointer">
                  <td><strong>${a.name}</strong><br><span style="font-size:10px;color:var(--text-muted)">${a.industry}</span></td>
                  <td>${a.plan}</td>
                  <td>${FMT.currency(a.mrr)}</td>
                  <td><span class="tag ${FMT.tagClass(a.health)}">${a.health.replace('_',' ')}</span>
                    <div style="font-size:10px;color:var(--text-dim);margin-top:1px">Score: ${ctx.healthScore}</div></td>
                  <td style="color:${ctx.engagementScore >= 50 ? 'var(--green)' : 'var(--amber)'}">${ctx.engagementScore}</td>
                  <td><span style="font-size:12px;color:${riskFactor === 'On track' ? 'var(--text-dim)' : 'var(--amber)'}">${riskFactor}</span></td>
                  <td><span style="font-size:12px;color:${actionColor[topAction.priority] || 'var(--text-dim)'};font-weight:600">${topAction.label}</span></td>
                  <td><span style="font-weight:600;color:${ctx.renewalProbability != null && ctx.renewalProbability >= 0.85 ? 'var(--green)' : ctx.renewalProbability != null && ctx.renewalProbability >= 0.6 ? 'var(--amber)' : 'var(--red)'}">${renewalLabel}</span></td>
                </tr>`;
            }).join("")}
            </tbody>
          </table>
        </div>
      </div>`;
  }
  html += `</div>`;

  // ---- Expansion Opportunities ----
  html += `
    <div class="panel">
      <h3>Top Expansion Opportunities</h3>
      <div class="table-wrap">
        <table><thead><tr><th>Account</th><th>Plan</th><th>MRR</th><th>Score</th><th>Level</th><th>Factors</th></tr></thead><tbody>
        ${topExp.map(e => `
          <tr class="portfolio-row" data-account-id="${e.account.id}" style="cursor:pointer">
            <td>${e.account.name}</td>
            <td>${e.account.plan}</td>
            <td>${FMT.currency(e.account.mrr)}</td>
            <td><strong>${e.opportunity.score}</strong></td>
            <td><span class="tag" style="background:${e.opportunity.level === 'strong' ? 'var(--green-dim)' : e.opportunity.level === 'moderate' ? 'var(--amber-dim)' : 'var(--bg)'};color:${e.opportunity.level === 'strong' ? 'var(--green)' : e.opportunity.level === 'moderate' ? 'var(--amber)' : 'var(--text-dim)'}">${e.opportunity.level}</span></td>
            <td style="font-size:11px">${e.opportunity.factors.filter(f => f.score > 0).slice(0,3).map(f => f.name).join(" · ")}</td>
          </tr>
        `).join("")}
        </tbody></table>
      </div>
    </div>
  `;

  document.getElementById("portfolio-content").innerHTML = html;

  // Click-to-select-account behavior
  document.querySelectorAll(".portfolio-row").forEach(row => {
    row.addEventListener("click", () => {
      const accountId = row.dataset.accountId;
      if (accountId) {
        filterState.set("selectedAccountId", accountId);
      }
    });
  });
}

