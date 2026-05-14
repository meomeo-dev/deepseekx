import { FMT } from "./format.js";

export function renderIncidents(store) {
  const s = store.selectors.incidentSummary();

  document.getElementById("incident-kpi-cards").innerHTML = [
    { label: "Open Incidents", value: s.openIncidents.length, cls: s.openIncidents.length > 0 ? "red" : "green" },
    { label: "MTTR", value: FMT.durationM(s.mttrM) },
    { label: "Sev0/S1 Active", value: s.openIncidents.filter(i => i.severity === "sev0" || i.severity === "sev1").length, cls: "red" },
    { label: "Total (all time)", value: store.state.incidents.length },
  ].map(c => `
    <div class="card">
      <div class="card-label">${c.label}</div>
      <div class="card-value ${c.cls || ""}">${c.value}</div>
    </div>
  `).join("");

  document.getElementById("incident-table").innerHTML = `
    <h3>All Incidents</h3>
    <table><thead><tr><th>ID</th><th>Title</th><th>Severity</th><th>Status</th><th>Duration</th><th>Affected</th><th>Opened</th></tr></thead><tbody>
    ${store.state.incidents.map(inc => `
      <tr>
        <td style="font-family:var(--font-mono);font-size:11px">${inc.id}</td>
        <td>${inc.title}</td>
        <td><span class="tag ${FMT.tagClass(inc.severity)}">${inc.severity}</span></td>
        <td><span class="tag ${FMT.tagClass(inc.status)}">${inc.status.replace(/_/g," ")}</span></td>
        <td>${FMT.durationM(inc.duration_m)}</td>
        <td>${inc.affected_accounts}</td>
        <td>${FMT.shortDate(inc.opened_at)}</td>
      </tr>
    `).join("")}
    </tbody></table>
  `;
}
