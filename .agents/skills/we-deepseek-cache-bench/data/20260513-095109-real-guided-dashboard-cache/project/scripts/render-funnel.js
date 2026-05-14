import { FMT } from "./format.js";

export function renderFunnel(store) {
  const weeks = store.selectors.funnelByWeek();
  const latest = weeks[weeks.length - 1];
  const rates = store.selectors.funnelCurrentRates();

  // Stage values with bars
  const stages = ["visitors","signups","trials_started","activated","qualified","won"];
  const maxVal = Math.max(...stages.map(s => latest[s] || 0), 1);

  document.getElementById("funnel-rates").innerHTML = `
    <h3>Latest Funnel (${latest.week})</h3>
    ${stages.map((s, i) => {
      const val = latest[s] || 0;
      const pct = (val / maxVal * 100).toFixed(0);
      const colors = ["var(--text-muted)","var(--purple)","var(--accent)","var(--teal)","var(--amber)","var(--green)"];
      return `
        <div class="bar-row">
          <span class="bar-label">${s.replace("_"," ")}</span>
          <div class="bar-track">
            <div class="bar-fill" style="width:${pct}%;background:${colors[i]}"></div>
          </div>
          <span class="bar-val bar-val-mono">${FMT.number(val)}</span>
        </div>
      `;
    }).join("")}
    <div style="margin-top:12px">
      <span style="font-size:12px;color:var(--text-dim)">Overall conversion: </span>
      <span style="font-weight:700">${FMT.pctPlain(latest.conversion_to_won)}</span>
    </div>
  `;

  document.getElementById("funnel-table").innerHTML = `
    <h3>Stage-to-Stage Conversion Rates</h3>
    <table><thead><tr><th>From</th><th>To</th><th>Rate</th></tr></thead><tbody>
    ${rates.map(r => `
      <tr>
        <td>${r.from.replace("_"," ")}</td>
        <td>${r.to.replace("_"," ")}</td>
        <td><strong>${FMT.pctPlain(r.rate)}</strong></td>
      </tr>
    `).join("")}
    </tbody></table>
  `;
}
