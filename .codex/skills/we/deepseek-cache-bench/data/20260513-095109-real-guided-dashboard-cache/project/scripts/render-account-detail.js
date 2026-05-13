// Northstar Ops Console — Account detail panel.
import { FMT } from "./format.js";
import { computeHealthScore, computeEngagementScore, churnRiskCategory } from "./scoring/account-scoring.js";
import { forecastRenewal } from "./scoring/renewal-forecast.js";

export function renderAccountDetail(store, fixtures, filterState) {
  const accountId = filterState.get("selectedAccountId");
  const panel = document.getElementById("account-detail-panel");
  if (!panel) return;

  if (!accountId) {
    panel.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text-dim)">Select an account to view details</div>`;
    return;
  }

  const account = store.state.accounts.find(a => a.id === accountId);
  if (!account) {
    panel.innerHTML = `<div style="padding:24px;text-align:center;color:var(--red)">Account not found</div>`;
    return;
  }

  const accountTickets = store.state.tickets.filter(t => t.account_id === accountId);
  const accountUsage = (fixtures.usageEvents || []).filter(e => e.account_id === accountId);
  const accountNps = (fixtures.npsResponses || []).filter(n => n.account_id === accountId);
  const contract = (fixtures.contracts || {})[accountId];
  const successPlan = (fixtures.successPlans || []).find(p => p.account_id === accountId);
  const adoption = (fixtures.featureAdoption || {})[accountId] || {};
  const anomalies = (fixtures.usageAnomalies || []).filter(a => a.account_id === accountId);
  const accountIncidents = store.state.incidents;

  // Scoring
  const healthScore = computeHealthScore(account, accountTickets, accountUsage);
  const engagementScore = computeEngagementScore(account, accountUsage, accountTickets, accountNps);
  const renewal = forecastRenewal(account, healthScore, engagementScore, contract);
  const risk = churnRiskCategory(healthScore);

  // Revenue history
  const revenueEvents = (store.state.revenue_events || [])
    .filter(e => e.account_id === accountId)
    .sort((a, b) => a.timestamp - b.timestamp);

  // Open tickets
  const openTickets = accountTickets.filter(t => t.status !== "resolved");

  panel.innerHTML = `
    <div class="acct-header">
      <div>
        <h2 style="margin:0">${account.name}</h2>
        <span style="color:var(--text-dim);font-size:13px">${account.plan} · ${account.industry} · Since ${FMT.shortDate(account.created_at)}</span>
      </div>
      <div style="text-align:right">
        <span class="tag ${FMT.tagClass(account.health)}" style="font-size:13px;padding:4px 12px">${account.health.replace("_"," ")}</span>
        ${contract ? `<div style="font-size:11px;color:var(--text-dim);margin-top:4px">Renews ${FMT.shortDate(contract.renewal_date)}</div>` : ""}
      </div>
    </div>

    <div class="card-grid" style="grid-template-columns:repeat(4,1fr)">
      <div class="card">
        <div class="card-label">MRR</div>
        <div class="card-value">${FMT.currency(account.mrr)}</div>
      </div>
      <div class="card">
        <div class="card-label">Health Score</div>
        <div class="card-value" style="color:${risk.color}">${healthScore.score}/100</div>
        <div class="card-change" style="color:${risk.color}">${risk.label}</div>
      </div>
      <div class="card">
        <div class="card-label">Engagement</div>
        <div class="card-value">${engagementScore.score}/100</div>
        <div class="card-change">${engagementScore.active_days}d active (30d)</div>
      </div>
      <div class="card">
        <div class="card-label">Renewal Probability</div>
        <div class="card-value ${renewal.probability != null && renewal.probability >= 0.85 ? 'green' : renewal.probability != null && renewal.probability >= 0.6 ? 'amber' : 'red'}">
          ${renewal.probability != null ? (renewal.probability * 100).toFixed(0) + '%' : '—'}
        </div>
        <div class="card-change">${renewal.days_until_renewal != null ? renewal.days_until_renewal + ' days left' : ''}</div>
      </div>
    </div>

    <div class="two-col">
      <div class="panel">
        <h3>Health Factors</h3>
        ${healthScore.deductions.length > 0
          ? `<ul style="list-style:none;padding:0">${healthScore.deductions.map(d => `<li style="padding:4px 0;font-size:12px;color:var(--amber)">⚠ ${d}</li>`).join("")}</ul>`
          : `<p style="font-size:13px;color:var(--green)">✓ No health concerns detected</p>`
        }
        ${anomalies.length > 0 ? `
          <h4 style="margin-top:12px;font-size:12px;color:var(--text-muted)">Usage Anomalies</h4>
          ${anomalies.map(a => `<div style="font-size:11px;color:var(--amber);padding:2px 0">⚠ ${FMT.shortDate(a.timestamp)}: ${a.description} (${a.severity})</div>`).join("")}
        ` : ""}
      </div>
      <div class="panel">
        <h3>Recommended Actions</h3>
        <ul style="list-style:none;padding:0;font-size:13px">
          ${buildRecommendations(account, healthScore, renewal, engagementScore, successPlan, adoption, openTickets).map(r =>
            `<li style="padding:5px 0;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px">
              <span style="color:${r.priority === 'high' ? 'var(--red)' : r.priority === 'medium' ? 'var(--amber)' : 'var(--text-dim)'}">${r.priority === 'high' ? '●' : r.priority === 'medium' ? '◐' : '○'}</span>
              ${r.action}
            </li>`
          ).join("")}
        </ul>
      </div>
    </div>

    <div class="two-col">
      <div class="panel">
        <h3>Revenue History</h3>
        <div class="table-wrap">
          <table><thead><tr><th>Date</th><th>Type</th><th>Amount</th></tr></thead><tbody>
          ${revenueEvents.slice(-12).reverse().map(e => `
            <tr><td>${FMT.shortDate(e.timestamp)}</td><td>${e.type.replace(/_/g," ")}</td>
            <td style="color:${e.amount >= 0 ? 'var(--green)' : 'var(--red)'}">${FMT.currency(e.amount)}</td></tr>
          `).join("")}
          </tbody></table>
        </div>
      </div>
      <div class="panel">
        <h3>Open Tickets (${openTickets.length})</h3>
        <div class="table-wrap">
          <table><thead><tr><th>ID</th><th>Title</th><th>Priority</th><th>Age</th></tr></thead><tbody>
          ${openTickets.slice(0, 8).map(t => {
            const ageD = Math.round((Date.now() - t.created_at) / 86400000);
            return `
            <tr><td style="font-family:var(--font-mono);font-size:11px">${t.id}</td><td style="font-size:12px">${t.title}</td>
            <td><span class="tag ${FMT.tagClass(t.priority)}">${t.priority}</span></td>
            <td>${ageD}d</td></tr>`;
          }).join("")}
          </tbody></table>
        </div>
      </div>
    </div>

    <div class="two-col">
      <div class="panel">
        <h3>Feature Adoption</h3>
        <div class="bar-row">
          <span class="bar-label">Adopted</span>
          <div class="bar-track"><div class="bar-fill" style="width:${(adoption.rate || 0)*100}%;background:var(--accent)"></div></div>
          <span class="bar-val">${adoption.adopted || 0}/${adoption.total_features_available || 0}</span>
        </div>
        <div style="margin-top:8px;font-size:12px">
          <span style="color:var(--green)">Using: ${(adoption.top_features || []).join(", ") || "—"}</span><br>
          <span style="color:var(--text-dim)">Not using: ${(adoption.unused_features || []).join(", ") || "—"}</span>
        </div>
      </div>
      <div class="panel">
        <h3>Success Plan (${successPlan ? Math.round(successPlan.pct * 100) : 0}%)</h3>
        ${successPlan ? successPlan.milestones.map(m => `
          <div style="font-size:12px;padding:3px 0;display:flex;align-items:center;gap:6px">
            <span>${m.completed ? '✓' : '○'}</span>
            <span style="color:${m.completed ? 'var(--green)' : 'var(--text-dim)'}">${m.name}</span>
            <span style="color:var(--text-muted);font-size:10px;margin-left:auto">${FMT.shortDate(m.due_date)}</span>
          </div>
        `).join("") : '<p style="font-size:13px;color:var(--text-dim)">No success plan configured</p>'}
      </div>
    </div>

    ${renewal.factors && renewal.factors.length > 0 ? `
      <div class="panel">
        <h3>Renewal Forecast Factors</h3>
        <div class="table-wrap">
          <table><thead><tr><th>Factor</th><th>Effect</th></tr></thead><tbody>
          ${renewal.factors.map(f => `
            <tr><td>${f.name}</td><td style="color:${f.effect >= 0 ? 'var(--green)' : 'var(--red)'}">${FMT.pct(f.effect * 100)}</td></tr>
          `).join("")}
          </tbody></table>
        </div>
      </div>
    ` : ""}
  `;
}

function buildRecommendations(account, healthScore, renewal, engagement, successPlan, adoption, openTickets) {
  const recs = [];

  if (healthScore.score < 50) {
    recs.push({ priority: "high", action: "Schedule urgent executive business review" });
    recs.push({ priority: "high", action: "Assign dedicated CSM if not already assigned" });
  }
  if (healthScore.score < 70 && healthScore.score >= 50) {
    recs.push({ priority: "medium", action: "Conduct health check call within 7 days" });
  }

  if (openTickets.filter(t => t.priority === "critical" || t.priority === "high").length > 0) {
    recs.push({ priority: "high", action: "Resolve critical/high-priority tickets before renewal conversation" });
  }

  if (engagement.score < 40) {
    recs.push({ priority: "medium", action: "Send re-engagement campaign with product tips" });
  }

  if (renewal.days_until_renewal != null && renewal.days_until_renewal < 30 && healthScore.score < 80) {
    recs.push({ priority: "high", action: `Renewal in ${renewal.days_until_renewal}d — prepare retention offer` });
  }

  if (successPlan && successPlan.pct < 0.5) {
    recs.push({ priority: "medium", action: "Accelerate success plan milestones" });
  }

  if (adoption && adoption.rate < 0.4) {
    recs.push({ priority: "low", action: "Schedule feature adoption workshop for unused features" });
  }

  if (account.health === "at_risk" && healthScore.score >= 70) {
    recs.push({ priority: "medium", action: "Account marked at-risk but health improving — monitor closely" });
  }

  if (recs.length === 0) {
    recs.push({ priority: "low", action: "Maintain regular cadence. No urgent actions needed." });
  }

  return recs;
}
