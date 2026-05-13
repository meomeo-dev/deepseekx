import { FMT } from "./format.js";

export function renderSupport(store) {
  const s = store.selectors.supportSummary();

  document.getElementById("support-kpi-cards").innerHTML = [
    { label: "Open Tickets", value: s.openTickets.length },
    { label: "Critical", value: s.openTickets.filter(t => t.priority === "critical").length, cls: "red" },
    { label: "Avg Resolution", value: FMT.durationH(s.avgResolutionH) },
    { label: "Unassigned", value: s.openTickets.filter(t => !t.assignee).length, cls: "amber" },
  ].map(c => `
    <div class="card">
      <div class="card-label">${c.label}</div>
      <div class="card-value ${c.cls || ""}">${c.value}</div>
    </div>
  `).join("");

  document.getElementById("support-table").innerHTML = `
    <h3>Open Tickets</h3>
    <table><thead><tr><th>ID</th><th>Account</th><th>Title</th><th>Priority</th><th>Status</th><th>Assignee</th><th>Opened</th></tr></thead><tbody>
    ${s.openTickets.map(t => `
      <tr>
        <td style="font-family:var(--font-mono);font-size:11px">${t.id}</td>
        <td>${t.account_name}</td>
        <td>${t.title}</td>
        <td><span class="tag ${FMT.tagClass(t.priority)}">${t.priority}</span></td>
        <td><span class="tag ${FMT.tagClass(t.status)}">${t.status.replace(/_/g," ")}</span></td>
        <td>${t.assignee || "—"}</td>
        <td>${FMT.date(t.created_at)}</td>
      </tr>
    `).join("")}
    </tbody></table>
  `;
}
