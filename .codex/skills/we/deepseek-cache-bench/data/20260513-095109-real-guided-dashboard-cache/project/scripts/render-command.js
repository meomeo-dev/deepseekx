// Command Center renderer — triage, SLA queue, blast radius, runbooks, comms.
import { FMT } from "./format.js";
import { routeEscalation, buildTriageCard, triageSummary } from "./command-center/escalation-routing.js";
import { buildSlaQueue, slaQueueSummary } from "./command-center/sla-priority-queue.js";
import { estimateBlastRadius } from "./command-center/blast-radius.js";
import { generateStatusUpdate, batchGenerateCustomerComms } from "./command-center/communication-drafts.js";
import { recommendRunbooks } from "./command-center/runbook-recommendation.js";

export function renderCommand(store, fixtures, filterState) {
  const allFixtures = { ...fixtures, ...(store.state.fixtures || {}) };
  const incidents = store.state.incidents;
  const tickets = store.state.tickets;
  const accounts = store.state.accounts;
  const onCallSchedule = allFixtures.onCallSchedule || [];
  const escalationPolicies = allFixtures.escalationPolicies || {};
  const serviceOwnership = allFixtures.serviceOwnership || {};
  const incidentAccountImpact = allFixtures.incidentAccountImpact || {};
  const postmortemTasks = allFixtures.postmortemTasks || [];
  const statusPageUpdates = allFixtures.statusPageUpdates || [];

  const activeIncidents = incidents.filter(i => i.status !== "closed" && i.status !== "resolved");

  // Build triage cards for active incidents
  const allCards = [];
  for (const inc of activeIncidents) {
    const route = routeEscalation(inc, onCallSchedule, escalationPolicies, serviceOwnership);
    const blast = estimateBlastRadius(inc, accounts, tickets, incidentAccountImpact);
    allCards.push(buildTriageCard(inc, route, blast));
  }
  // Also add open critical/high tickets as escalation items
  const escalatedTickets = tickets.filter(t =>
    t.status !== "resolved" && (t.priority === "critical" || t.priority === "high")
  );
  for (const t of escalatedTickets.slice(0, 6)) {
    const elapsedM = Math.round((Date.now() - t.created_at) / 60000);
    allCards.push({
      incident_id: t.id,
      title: t.title,
      severity: t.priority,
      status: t.status,
      elapsed_m: elapsedM,
      on_call: t.assignee || "unassigned",
      team: "support",
      service: "support-queue",
      escalated: elapsedM > (t.priority === "critical" ? 240 : 480),
      escalation_tier: 0,
      page: false,
      affected_accounts: 1,
      impact_score: null,
      impact_level: null,
      sla_status: elapsedM > (t.priority === "critical" ? 240 : 480) ? "breached" : "ok",
      is_ticket: true,
    });
  }

  const triage = triageSummary(allCards);

  // SLA queue
  const slaQueue = buildSlaQueue(tickets, incidents);
  const slaSum = slaQueueSummary(slaQueue);

  // Postmortem counts
  const pendingPMs = postmortemTasks.filter(t => !t.completed).length;
  const overduePMs = postmortemTasks.filter(t => !t.completed && t.due_date < Date.now()).length;

  // ---- HTML ----
  let html = "";

  // Triage KPI cards
  html += `
    <div class="card-grid">
      <div class="card"><div class="card-label">Active Incidents</div><div class="card-value ${activeIncidents.length > 0 ? 'red' : 'green'}">${activeIncidents.length}</div></div>
      <div class="card"><div class="card-label">Sev0/Sev1</div><div class="card-value red">${triage.bySeverity.sev0 + triage.bySeverity.sev1}</div></div>
      <div class="card"><div class="card-label">SLA Breached</div><div class="card-value ${triage.breached_sla > 0 ? 'red' : ''}">${triage.breached_sla}</div></div>
      <div class="card"><div class="card-label">Escalated</div><div class="card-value amber">${triage.escalated}</div></div>
      <div class="card"><div class="card-label">Pages Needed</div><div class="card-value ${triage.needs_page > 0 ? 'red' : ''}">${triage.needs_page}</div></div>
      <div class="card"><div class="card-label">SLA Queue</div><div class="card-value ${slaSum.total_breaches > 0 ? 'amber' : ''}">${slaSum.total_breaches}</div></div>
      <div class="card"><div class="card-label">Pending Postmortems</div><div class="card-value">${pendingPMs}</div></div>
      <div class="card"><div class="card-label">Overdue PM Tasks</div><div class="card-value ${overduePMs > 0 ? 'red' : ''}">${overduePMs}</div></div>
    </div>
  `;

  // ---- Active Incident Triage Table ----
  html += `
    <div class="panel">
      <h3>Active Triage Board</h3>
      <div class="table-wrap">
        <table><thead><tr>
          <th>ID</th><th>Title</th><th>Severity</th><th>Status</th><th>Elapsed</th>
          <th>On Call</th><th>SLA</th><th>Impact</th><th>Action</th>
        </tr></thead><tbody>
        ${allCards.map(c => {
          const slaClass = c.sla_status === "breached" ? "tag tag-at-risk" : "tag tag-healthy";
          const sevClass = c.is_ticket ? FMT.tagClass(c.severity) : FMT.tagClass(c.severity);
          return `
          <tr class="cc-row" data-id="${c.incident_id}" data-is-ticket="${c.is_ticket || false}" style="cursor:pointer">
            <td style="font-family:var(--font-mono);font-size:11px">${c.incident_id}</td>
            <td style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.title}</td>
            <td><span class="tag ${sevClass}">${c.severity}</span></td>
            <td><span class="tag ${FMT.tagClass(c.status)}">${c.status.replace(/_/g, ' ')}</span></td>
            <td style="font-weight:600;color:${c.elapsed_m > 240 ? 'var(--red)' : c.elapsed_m > 60 ? 'var(--amber)' : 'var(--text-dim)'}">${c.elapsed_m}m</td>
            <td>${c.on_call}</td>
            <td><span class="${slaClass}">${c.sla_status}</span></td>
            <td>${c.impact_level ? `<span style="color:${c.impact_level === 'severe' ? 'var(--red)' : c.impact_level === 'significant' ? 'var(--amber)' : 'var(--text-dim)'}">${c.impact_level}</span>` : '—'}</td>
            <td>${c.escalated ? '<span style="color:var(--amber);font-size:11px">Escalate</span>' : c.page ? '<span style="color:var(--red);font-size:11px">PAGE</span>' : '<span style="color:var(--text-dim);font-size:11px">Monitor</span>'}</td>
          </tr>`;
        }).join("")}
        ${allCards.length === 0 ? '<tr><td colspan="9" style="text-align:center;color:var(--green)">✓ No active incidents or escalations</td></tr>' : ''}
        </tbody></table>
      </div>
    </div>
  `;

  // ---- Two-column: SLA Queue + Runbooks/Comms ----
  html += `<div class="two-col">`;

  // SLA Breach Queue
  html += `
    <div class="panel">
      <h3>SLA Breach Queue (${slaQueue.length})</h3>
      <div class="table-wrap">
        <table><thead><tr><th>Type</th><th>ID</th><th>Severity</th><th>Over By</th><th>Score</th></tr></thead><tbody>
        ${slaQueue.slice(0, 8).map(q => `
          <tr>
            <td><span class="tag" style="background:${q.type === 'incident' ? 'var(--red-dim)' : 'var(--amber-dim)'};color:${q.type === 'incident' ? 'var(--red)' : 'var(--amber)'}">${q.type}</span></td>
            <td style="font-family:var(--font-mono);font-size:11px">${q.id}</td>
            <td><span class="tag ${FMT.tagClass(q.severity)}">${q.severity}</span></td>
            <td style="color:var(--red);font-weight:600">+${q.over_by_h.toFixed(1)}h</td>
            <td><strong>${q.score}</strong></td>
          </tr>
        `).join("")}
        ${slaQueue.length === 0 ? '<tr><td colspan="5" style="text-align:center;color:var(--green)">✓ No SLA breaches</td></tr>' : ''}
        </tbody></table>
      </div>
    </div>
  `;

  // Selected incident detail panel (show first active sev0/sev1, or first overall)
  const focusIncident = activeIncidents.find(i => i.severity === "sev0" || i.severity === "sev1") || activeIncidents[0];

  if (focusIncident) {
    const route = routeEscalation(focusIncident, onCallSchedule, escalationPolicies, serviceOwnership);
    const blast = estimateBlastRadius(focusIncident, accounts, tickets, incidentAccountImpact);
    const runbooks = recommendRunbooks(focusIncident);
    const statusUpdate = generateStatusUpdate(focusIncident, null, route, blast);
    const customerComms = batchGenerateCustomerComms(focusIncident, accounts, blast);

    html += `
      <div class="panel">
        <h3>Focus: ${focusIncident.title}</h3>
        <div class="metric-row" style="margin-bottom:8px">
          <div class="metric-item"><span class="metric-label">On Call</span><span class="metric-value" style="font-size:14px">${route.primary_contact}</span></div>
          <div class="metric-item"><span class="metric-label">Team</span><span class="metric-value" style="font-size:14px">${route.team}</span></div>
          <div class="metric-item"><span class="metric-label">Blast Radius</span><span class="metric-value" style="font-size:14px;color:${blast.blast_level === 'severe' ? 'var(--red)' : blast.blast_level === 'significant' ? 'var(--amber)' : 'var(--text-dim)'}">${blast.impacted_account_count} accts</span></div>
        </div>

        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin:8px 0 4px">Recommended Runbooks</div>
        ${runbooks.map(rb => `
          <div style="margin-bottom:8px;border:1px solid var(--border);border-radius:4px;padding:8px">
            <div style="font-weight:600;font-size:13px">📘 ${rb.name}</div>
            <div style="font-size:11px;color:var(--text-dim);margin:2px 0">${rb.description}</div>
            <ol style="margin:4px 0 0 16px;font-size:11px;color:var(--text-dim)">
              ${rb.steps.slice(0, 4).map(s => `<li>${s}</li>`).join("")}
              ${rb.steps.length > 4 ? `<li style="color:var(--text-muted)">+${rb.steps.length - 4} more steps</li>` : ''}
            </ol>
          </div>
        `).join("")}

        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin:8px 0 4px">Status Update</div>
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:8px;font-size:12px">
          <strong>${statusUpdate.title}</strong>
          <p style="margin-top:4px;color:var(--text-dim)">${statusUpdate.body}</p>
          <span style="font-size:10px;color:var(--text-muted)">Elapsed: ${statusUpdate.elapsed}</span>
        </div>

        ${customerComms.length > 0 && customerComms[0].should_send ? `
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin:8px 0 4px">Customer Communications</div>
          ${customerComms.filter(c => c.should_send).slice(0, 2).map(c => `
            <div style="font-size:11px;color:var(--text-dim);padding:2px 0">
              <span style="color:${c.should_send ? 'var(--amber)' : 'var(--text-dim)'}">✉</span> ${c.account_name}: ${c.subject}
            </div>
          `).join("")}
        ` : ''}

        ${blast.top_impacted.length > 0 ? `
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin:8px 0 4px">Top Impacted Accounts</div>
          ${blast.top_impacted.map(a => `
            <div class="cc-row" data-account-id="${a.id}" style="font-size:12px;padding:2px 0;cursor:pointer;display:flex;justify-content:space-between">
              <span>${a.name}</span>
              <span style="color:var(--text-dim)">${FMT.currency(a.mrr)} · <span class="tag ${FMT.tagClass(a.health)}" style="font-size:10px">${a.health}</span></span>
            </div>
          `).join("")}
        ` : ''}
      </div>
    `;
  } else {
    html += `<div class="panel"><h3>Focus</h3><p style="color:var(--text-dim);font-size:13px">No active incidents to display.</p></div>`;
  }

  html += `</div>`;

  // ---- Postmortem Tasks ----
  const pendingTasks = postmortemTasks.filter(t => !t.completed).sort((a, b) => a.due_date - b.due_date);
  html += `
    <div class="panel">
      <h3>Postmortem Action Items (${pendingTasks.length} pending)</h3>
      <div class="table-wrap">
        <table><thead><tr><th>Task</th><th>Incident</th><th>Type</th><th>Priority</th><th>Assignee</th><th>Due</th></tr></thead><tbody>
        ${pendingTasks.slice(0, 10).map(t => `
          <tr>
            <td>${t.title}</td>
            <td style="font-family:var(--font-mono);font-size:10px">${t.incident_id}</td>
            <td><span style="font-size:11px;color:var(--text-dim)">${t.type.replace(/_/g, ' ')}</span></td>
            <td><span class="tag ${t.priority === 'high' ? 'tag-sev0' : t.priority === 'medium' ? 'tag-running' : ''}">${t.priority}</span></td>
            <td>${t.assignee}</td>
            <td style="color:${t.due_date < Date.now() ? 'var(--red)' : 'var(--text-dim)'}">${FMT.shortDate(t.due_date)}</td>
          </tr>
        `).join("")}
        </tbody></table>
      </div>
    </div>
  `;

  document.getElementById("command-content").innerHTML = html;

  // Click handlers
  document.querySelectorAll(".cc-row").forEach(row => {
    row.addEventListener("click", () => {
      const accountId = row.dataset.accountId;
      const incidentId = row.dataset.id;
      if (accountId) {
        filterState.set("selectedAccountId", accountId);
      }
    });
  });
}
