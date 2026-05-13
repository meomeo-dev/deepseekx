import { FMT } from "./format.js";
const { tagClass, currency } = FMT;

export function renderHealth(store) {
  const h = store.selectors.healthSummary();
  const total = store.state.accounts.length;

  document.getElementById("health-distribution").innerHTML = `
    <h3>Health Distribution</h3>
    <div class="bar-row">
      <span class="bar-label">Healthy</span>
      <div class="bar-track"><div class="bar-fill" style="width:${(h.byHealth.healthy/total*100).toFixed(0)}%;background:var(--green)"></div></div>
      <span class="bar-val">${h.byHealth.healthy}</span>
    </div>
    <div class="bar-row">
      <span class="bar-label">At Risk</span>
      <div class="bar-track"><div class="bar-fill" style="width:${(h.byHealth.at_risk/total*100).toFixed(0)}%;background:var(--amber)"></div></div>
      <span class="bar-val">${h.byHealth.at_risk}</span>
    </div>
    <div class="bar-row">
      <span class="bar-label">Churned</span>
      <div class="bar-track"><div class="bar-fill" style="width:${(h.byHealth.churned/total*100).toFixed(0)}%;background:var(--red)"></div></div>
      <span class="bar-val">${h.byHealth.churned}</span>
    </div>
  `;

  document.getElementById("health-by-plan").innerHTML = `
    <h3>Health by Plan</h3>
    <table><thead><tr><th>Plan</th><th>Healthy</th><th>At Risk</th><th>Churned</th></tr></thead><tbody>
    ${Object.entries(h.byPlan).map(([plan, counts]) => `
      <tr>
        <td>${plan}</td>
        <td><span class="tag tag-healthy">${counts.healthy}</span></td>
        <td><span class="tag tag-at-risk">${counts.at_risk}</span></td>
        <td><span class="tag tag-churned">${counts.churned}</span></td>
      </tr>
    `).join("")}
    </tbody></table>
  `;

  document.getElementById("health-at-risk").innerHTML = `
    <h3>At-Risk Accounts (${h.atRiskAccounts.length})</h3>
    <table><thead><tr><th>Account</th><th>Plan</th><th>MRR</th><th>Industry</th><th>Usage %</th></tr></thead><tbody>
    ${h.atRiskAccounts.map(a => `
      <tr>
        <td>${a.name}</td>
        <td>${a.plan}</td>
        <td>${currency(a.mrr)}</td>
        <td>${a.industry}</td>
        <td><span style="color:var(--amber);font-weight:600">${a.usage_pct}%</span></td>
      </tr>
    `).join("")}
    </tbody></table>
  `;
}
