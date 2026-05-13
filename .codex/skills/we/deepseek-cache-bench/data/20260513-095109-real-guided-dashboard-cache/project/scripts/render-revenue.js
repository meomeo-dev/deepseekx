import { FMT } from "./format.js";

export function renderRevenue(store) {
  // KPI cards
  const k = store.selectors.summaryKpis();
  const byMonth = store.selectors.revenueByMonth();
  const last = byMonth[byMonth.length - 1];
  const prev = byMonth[byMonth.length - 2];
  const momGrowth = prev && prev.net ? ((last.net - prev.net) / prev.net * 100) : 0;

  document.getElementById("revenue-kpi-cards").innerHTML = [
    { label: "Current MRR", value: FMT.currency(k.total_mrr) },
    { label: "ARR", value: FMT.currency(k.arr) },
    { label: "MoM Growth", value: FMT.pct(momGrowth), cls: momGrowth >= 0 ? "green" : "red" },
    { label: "Active Accounts", value: k.active_accounts },
  ].map(c => `
    <div class="card">
      <div class="card-label">${c.label}</div>
      <div class="card-value ${c.cls || ""}">${c.value}</div>
    </div>
  `).join("");

  // Monthly net revenue bars
  const maxNet = Math.max(...byMonth.map(m => m.net), 1);
  const chartHtml = `<h3>Monthly Net Revenue</h3>` +
    byMonth.map(m => `
      <div class="bar-row">
        <span class="bar-label">${m.month}</span>
        <div class="bar-track">
          <div class="bar-fill" style="width:${(m.net / maxNet * 100).toFixed(0)}%;background:${m.net >= 0 ? 'var(--accent)' : 'var(--red)'}"></div>
        </div>
        <span class="bar-val bar-val-mono">${FMT.currency(m.net)}</span>
      </div>
    `).join("");
  document.getElementById("revenue-chart-panel").innerHTML = chartHtml;

  // By plan
  const byPlan = store.selectors.revenueByPlan();
  document.getElementById("revenue-plan-panel").innerHTML = `
    <h3>Revenue by Plan</h3>
    <table><thead><tr><th>Plan</th><th>Accounts</th><th>MRR</th><th>% of Total</th></tr></thead><tbody>
    ${byPlan.map(p => `
      <tr>
        <td>${p.plan}</td>
        <td>${p.accounts}</td>
        <td>${FMT.currency(p.mrr)}</td>
        <td>${FMT.pctPlain(p.mrr / k.total_mrr * 100)}</td>
      </tr>
    `).join("")}
    </tbody></table>
  `;
}
