import { FMT } from "./format.js";

export function renderDeployments(store) {
  const d = store.selectors.deploymentSummary();

  document.getElementById("deploy-kpi-cards").innerHTML = [
    { label: "Recent Deploys", value: d.recent.length },
    { label: "In Progress", value: d.recent.filter(dp => dp.status === "in_progress").length, cls: "amber" },
    { label: "Rollbacks", value: d.recent.filter(dp => dp.status === "rolled_back").length, cls: "red" },
    { label: "High Risk", value: d.recent.filter(dp => dp.risk_score >= 8).length, cls: "red" },
  ].map(c => `
    <div class="card">
      <div class="card-label">${c.label}</div>
      <div class="card-value ${c.cls || ""}">${c.value}</div>
    </div>
  `).join("");

  document.getElementById("deploy-table").innerHTML = `
    <h3>Recent Deployments</h3>
    <table><thead><tr><th>Service</th><th>Version</th><th>Env</th><th>Status</th><th>Risk</th><th>Author</th><th>Started</th><th>Duration</th></tr></thead><tbody>
    ${d.recent.map(dp => {
      const dur = dp.completed_at ? FMT.durationM((dp.completed_at - dp.started_at) / 60000) : "—";
      return `
        <tr>
          <td>${dp.service}</td>
          <td style="font-family:var(--font-mono);font-size:11px">${dp.version}</td>
          <td>${dp.environment}</td>
          <td><span class="tag ${FMT.tagClass(dp.status)}">${dp.status.replace(/_/g," ")}</span></td>
          <td><span style="color:${FMT.riskColor(dp.risk_score)};font-weight:600">${dp.risk_score}/10</span></td>
          <td>${dp.author}</td>
          <td>${FMT.datetime(dp.started_at)}</td>
          <td>${dur}</td>
        </tr>
      `;
    }).join("")}
    </tbody></table>
  `;
}
