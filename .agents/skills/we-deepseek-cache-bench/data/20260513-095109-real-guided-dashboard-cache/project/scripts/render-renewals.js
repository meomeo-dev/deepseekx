// Renewals renderer — calendar, forecast, probability bands, workload, intervention queue.
import { FMT } from "./format.js";
import { generateRenewalCalendar, calendarSummary, interventionQueue, probabilityBands } from "./renewals/calendar.js";
import { computeOwnerWorkload, workloadSummary } from "./renewals/owner-workload.js";

export function renderRenewals(store, fixtures, filterState) {
  const allFixtures = { ...fixtures, ...(store.state.fixtures || {}) };
  const accounts = store.state.accounts;
  const contracts = allFixtures.contracts || {};
  const meetings = allFixtures.meetings || [];
  const renewalTasks = allFixtures.renewalTasks || [];
  const ownerCapacity = allFixtures.ownerCapacity || {};

  // Generate calendar
  const calendar = generateRenewalCalendar(accounts, contracts, 120);

  // Build probability map from health
  const now = Date.now();
  const DAY = 86400000;
  const probMap = {};
  for (const c of calendar) {
    const a = accounts.find(ac => ac.id === c.account_id);
    if (!a) { probMap[c.account_id] = 0.85; continue; }
    const contract = contracts[a.id];
    const daysLeft = contract ? (contract.renewal_date - now) / DAY : 90;
    let prob = a.health === "healthy" ? 0.90 : a.health === "at_risk" ? 0.55 : 0.30;
    if (contract?.success_plan_pct > 0.7) prob += 0.05;
    if (contract?.auto_renew) prob += 0.03;
    probMap[c.account_id] = parseFloat(Math.min(0.99, Math.max(0.1, prob)).toFixed(4));
  }

  const cs = calendarSummary(calendar, probMap);
  const pb = probabilityBands(calendar, probMap);

  // Health scores map
  const healthScores = {};
  const engagementScores = {};
  for (const a of accounts) {
    const hs = a.health === "healthy" ? 70 + (a.name.length * 3 % 20) :
                a.health === "at_risk" ? 25 + (a.name.length * 3 % 25) : 0;
    healthScores[a.id] = { score: hs };
    engagementScores[a.id] = { score: 40 + (a.name.length * 5 % 40) };
  }

  const queue = interventionQueue(calendar, healthScores, engagementScores, probMap);

  // Owner workload
  const workload = computeOwnerWorkload(calendar, ownerCapacity, meetings);
  const wlSummary = workloadSummary(workload);

  // Upcoming QBRs (next 30 days)
  const upcomingQbrs = meetings.filter(m => m.type === "qbr" && m.scheduled > now && m.scheduled < now + 30 * DAY)
    .sort((a, b) => a.scheduled - b.scheduled);

  // Upcoming tasks (next 14 days, incomplete)
  const upcomingTasks = renewalTasks.filter(t => !t.completed && t.due_date > now && t.due_date < now + 14 * DAY)
    .sort((a, b) => a.due_date - b.due_date);

  // ---- HTML ----
  let html = "";

  // KPI cards
  html += `
    <div class="card-grid">
      <div class="card"><div class="card-label">Upcoming Renewals (120d)</div><div class="card-value">${cs.total_upcoming}</div></div>
      <div class="card"><div class="card-label">Renewal ARR at Risk</div><div class="card-value amber">${FMT.currency(cs.next_120_days.expected_arr)}</div></div>
      <div class="card"><div class="card-label">Next 30 Days</div><div class="card-value">${cs.next_30_days.count}</div></div>
      <div class="card"><div class="card-label">At-Risk Renewals</div><div class="card-value red">${cs.at_risk_count}</div></div>
      <div class="card"><div class="card-label">Intervention Needed</div><div class="card-value amber">${queue.length}</div></div>
      <div class="card"><div class="card-label">Upcoming QBRs</div><div class="card-value">${upcomingQbrs.length}</div></div>
    </div>
  `;

  // ---- Forecast Bands ----
  html += `
    <div class="panel">
      <h3>Renewal Forecast by Probability Band</h3>
      <div class="metric-row" style="margin-bottom:12px">
        <div class="metric-item"><span class="metric-label">High (≥85%)</span><span class="metric-value" style="color:var(--green)">${pb.high_count}</span><span style="font-size:11px;color:var(--text-dim)">${FMT.currency(pb.high_arr)}</span></div>
        <div class="metric-item"><span class="metric-label">Medium (60-84%)</span><span class="metric-value" style="color:var(--amber)">${pb.medium_count}</span><span style="font-size:11px;color:var(--text-dim)">${FMT.currency(pb.medium_arr)}</span></div>
        <div class="metric-item"><span class="metric-label">Low (<60%)</span><span class="metric-value" style="color:var(--red)">${pb.low_count}</span><span style="font-size:11px;color:var(--text-dim)">${FMT.currency(pb.low_arr)}</span></div>
      </div>
      <div class="bar-row">
        <span class="bar-label">High</span>
        <div class="bar-track"><div class="bar-fill" style="width:${calendar.length > 0 ? (pb.high_count / calendar.length * 100).toFixed(0) : 0}%;background:var(--green)"></div></div>
        <span class="bar-val">${pb.high_count}</span>
      </div>
      <div class="bar-row">
        <span class="bar-label">Medium</span>
        <div class="bar-track"><div class="bar-fill" style="width:${calendar.length > 0 ? (pb.medium_count / calendar.length * 100).toFixed(0) : 0}%;background:var(--amber)"></div></div>
        <span class="bar-val">${pb.medium_count}</span>
      </div>
      <div class="bar-row">
        <span class="bar-label">Low</span>
        <div class="bar-track"><div class="bar-fill" style="width:${calendar.length > 0 ? (pb.low_count / calendar.length * 100).toFixed(0) : 0}%;background:var(--red)"></div></div>
        <span class="bar-val">${pb.low_count}</span>
      </div>
    </div>
  `;

  // ---- 120-Day Renewal Calendar ----
  html += `
    <div class="panel">
      <h3>120-Day Renewal Calendar</h3>
      <div class="table-wrap">
        <table><thead><tr><th>Account</th><th>Plan</th><th>MRR</th><th>Renewal Date</th><th>Days Left</th><th>Probability</th><th>CS Owner</th><th>Health</th></tr></thead><tbody>
        ${calendar.map(c => `
          <tr class="portfolio-row" data-account-id="${c.account_id}" style="cursor:pointer">
            <td><strong>${c.account_name}</strong></td>
            <td>${c.plan}</td>
            <td>${FMT.currency(c.mrr)}</td>
            <td>${FMT.shortDate(c.renewal_date)}</td>
            <td style="font-weight:600;color:${c.days_until_renewal <= 30 ? 'var(--red)' : c.days_until_renewal <= 60 ? 'var(--amber)' : 'var(--text-dim)'}">${c.days_until_renewal}d</td>
            <td style="font-weight:600;color:${(probMap[c.account_id] || 0) >= 0.85 ? 'var(--green)' : (probMap[c.account_id] || 0) >= 0.6 ? 'var(--amber)' : 'var(--red)'}">${probMap[c.account_id] ? (probMap[c.account_id] * 100).toFixed(0) + '%' : '—'}</td>
            <td>${c.cs_owner}</td>
            <td><span class="tag ${FMT.tagClass(c.health)}">${c.health.replace('_',' ')}</span></td>
          </tr>
        `).join("")}
        </tbody></table>
      </div>
    </div>
  `;

  // ---- Intervention Queue + Upcoming QBRs ----
  html += `<div class="two-col">`;

  html += `
    <div class="panel">
      <h3>Intervention Queue (${queue.length})</h3>
      <div class="table-wrap">
        <table><thead><tr><th>Account</th><th>Days Left</th><th>MRR</th><th>Risk Reason</th><th>Health</th></tr></thead><tbody>
        ${queue.slice(0, 10).map(q => `
          <tr class="portfolio-row" data-account-id="${q.account_id}" style="cursor:pointer">
            <td>${q.account_name}</td>
            <td style="color:var(--red);font-weight:600">${q.days_until_renewal}d</td>
            <td>${FMT.currency(q.mrr)}</td>
            <td style="font-size:12px;color:var(--amber)">${q.risk_reason}</td>
            <td><span class="tag ${FMT.tagClass(q.health)}">${q.health.replace('_',' ')}</span></td>
          </tr>
        `).join("")}
        ${queue.length === 0 ? '<tr><td colspan="5" style="color:var(--text-dim);text-align:center">No accounts require intervention</td></tr>' : ''}
        </tbody></table>
      </div>
    </div>
  `;

  html += `
    <div class="panel">
      <h3>Upcoming QBRs & Tasks</h3>
      ${upcomingQbrs.length > 0 ? `
        <div style="margin-bottom:12px">
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Upcoming QBRs (30d)</div>
          ${upcomingQbrs.slice(0, 5).map(m => `
            <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;border-bottom:1px solid var(--border)">
              <span>${m.account_name}</span>
              <span style="color:var(--text-dim)">${FMT.shortDate(m.scheduled)} — ${m.owner || 'unassigned'}</span>
            </div>
          `).join("")}
        </div>
      ` : '<div style="font-size:12px;color:var(--text-dim)">No upcoming QBRs</div>'}
      <div style="margin-top:12px">
        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Upcoming Tasks (14d)</div>
        ${upcomingTasks.slice(0, 8).map(t => `
          <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:11px;border-bottom:1px solid var(--border)">
            <span>${t.title}</span>
            <span style="color:var(--text-dim)">${t.account_name} · ${FMT.shortDate(t.due_date)}</span>
          </div>
        `).join("")}
        ${upcomingTasks.length === 0 ? '<div style="font-size:12px;color:var(--text-dim)">No upcoming tasks</div>' : ''}
      </div>
    </div>
  `;
  html += `</div>`;

  // ---- Owner Workload ----
  html += `
    <div class="panel">
      <h3>CSM Workload</h3>
      <div class="metric-row" style="margin-bottom:12px">
        <div class="metric-item"><span class="metric-label">Owners</span><span class="metric-value">${wlSummary.total_owners}</span></div>
        <div class="metric-item"><span class="metric-label">Overloaded</span><span class="metric-value" style="color:${wlSummary.overloaded > 0 ? 'var(--red)' : 'var(--green)'}">${wlSummary.overloaded}</span></div>
        <div class="metric-item"><span class="metric-label">Avg Accounts</span><span class="metric-value">${wlSummary.avg_accounts_per_owner}</span></div>
        <div class="metric-item"><span class="metric-label">Avg Utilization</span><span class="metric-value">${(wlSummary.avg_utilization * 100).toFixed(0)}%</span></div>
      </div>
      <div class="table-wrap">
        <table><thead><tr><th>CSM</th><th>Accounts</th><th>MRR Managed</th><th>Renewals (30d)</th><th>Utilization</th><th>Status</th></tr></thead><tbody>
        ${wlSummary.by_owner.map(o => `
          <tr>
            <td>${o.owner}</td>
            <td>${o.accounts.length}</td>
            <td>${FMT.currency(o.total_mrr)}</td>
            <td>${o.monthly_renewals}</td>
            <td>
              <div class="bar-row" style="margin:0">
                <div class="bar-track" style="height:12px"><div class="bar-fill" style="width:${(o.account_utilization * 100).toFixed(0)}%;background:${o.account_utilization > 0.85 ? 'var(--red)' : o.account_utilization > 0.6 ? 'var(--amber)' : 'var(--green)'}"></div></div>
                <span class="bar-val">${(o.account_utilization * 100).toFixed(0)}%</span>
              </div>
            </td>
            <td><span class="tag ${o.overloaded ? 'tag-at-risk' : o.status === 'busy' ? 'tag-running' : 'tag-healthy'}">${o.status}</span></td>
          </tr>
        `).join("")}
        </tbody></table>
      </div>
    </div>
  `;

  document.getElementById("renewals-content").innerHTML = html;

  // Click-to-select-account
  document.querySelectorAll("#renewals-content .portfolio-row").forEach(row => {
    row.addEventListener("click", () => {
      const accountId = row.dataset.accountId;
      if (accountId) filterState.set("selectedAccountId", accountId);
    });
  });
}
