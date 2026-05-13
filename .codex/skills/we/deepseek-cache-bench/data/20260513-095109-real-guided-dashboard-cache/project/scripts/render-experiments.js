import { FMT } from "./format.js";

export function renderExperiments(store) {
  const exps = store.selectors.experimentSummary();

  document.getElementById("experiment-table").innerHTML = `
    <h3>Experiments</h3>
    <table><thead><tr><th>Name</th><th>Status</th><th>Variant A</th><th>Variant B</th><th>Metric</th><th>Lift</th><th>Confidence</th><th>Started</th></tr></thead><tbody>
    ${exps.map(e => `
      <tr>
        <td>${e.name}</td>
        <td><span class="tag ${FMT.tagClass(e.status)}">${e.status}</span></td>
        <td>${FMT.number(e.variant_a_users)}</td>
        <td>${FMT.number(e.variant_b_users)}</td>
        <td>${e.metric.replace(/_/g," ")}</td>
        <td style="color:${e.lift_pct >= 0 ? 'var(--green)' : 'var(--red)'};font-weight:600">${FMT.pct(e.lift_pct)}</td>
        <td>${FMT.pctPlain(e.confidence * 100)}</td>
        <td>${FMT.shortDate(e.started_at)}</td>
      </tr>
    `).join("")}
    </tbody></table>
  `;
}
