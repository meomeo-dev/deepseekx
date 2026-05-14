import { FMT } from "./format.js";

export function renderSummary(store) {
  const k = store.selectors.summaryKpis();
  const cards = document.getElementById("kpi-cards");
  cards.innerHTML = [
    { label: "MRR",       value: FMT.currency(k.total_mrr),    change: FMT.pct(k.mrr_growth_pct), cls: "" },
    { label: "ARR",       value: FMT.currency(k.arr),           change: "", cls: "" },
    { label: "Active Accounts", value: k.active_accounts,       change: "", cls: "" },
    { label: "Churn Rate", value: FMT.pctPlain(k.churn_rate),   change: "", cls: "amber" },
    { label: "Healthy %", value: FMT.pctPlain(k.healthy_pct),   change: "", cls: "green" },
    { label: "At Risk",   value: k.at_risk_count,               change: "", cls: "amber" },
    { label: "Open Tickets", value: k.open_tickets,             change: k.critical_tickets > 0 ? `${k.critical_tickets} critical` : "", cls: "" },
    { label: "Open Incidents", value: k.open_incidents,         change: "", cls: k.open_incidents > 0 ? "red" : "green" },
    { label: "Active Experiments", value: k.active_experiments, change: "", cls: "" },
    { label: "Avg CSAT",  value: k.avg_ticket_satisfaction ? k.avg_ticket_satisfaction.toFixed(1) + " ★" : "—", change: "", cls: "" },
    { label: "Deployments (24h)", value: k.deployments_today,   change: "", cls: "" },
    { label: "At-Risk MRR", value: FMT.currency(k.at_risk_count * 4500), change: "", cls: "amber" },
  ].map(c => `
    <div class="card">
      <div class="card-label">${c.label}</div>
      <div class="card-value ${c.cls}">${c.value}</div>
      ${c.change ? `<div class="card-change ${c.change.startsWith("+") ? "up" : "down"}">${c.change}</div>` : ""}
    </div>
  `).join("");

  const rev = store.selectors.revenueByMonth();
  const last3 = rev.slice(-3);
  const revHtml = `
    <h3>Recent MRR Trend</h3>
    <div class="bar-row">${last3.map(m => `
      <div style="flex:1;text-align:center">
        <div style="font-size:11px;color:var(--text-muted)">${m.month}</div>
        <div style="font-size:18px;font-weight:700;margin-top:4px">${FMT.currency(m.net)}</div>
      </div>
    `).join("")}</div>
  `;
  document.getElementById("summary-revenue-mini").innerHTML = revHtml;

  const h = store.selectors.healthSummary();
  const healthHtml = `
    <h3>Customer Health</h3>
    <div class="bar-row">
      <span class="bar-label">Healthy</span>
      <div class="bar-track"><div class="bar-fill" style="width:${(h.byHealth.healthy/store.state.accounts.length*100).toFixed(0)}%;background:var(--green)"></div></div>
      <span class="bar-val">${h.byHealth.healthy}</span>
    </div>
    <div class="bar-row">
      <span class="bar-label">At Risk</span>
      <div class="bar-track"><div class="bar-fill" style="width:${(h.byHealth.at_risk/store.state.accounts.length*100).toFixed(0)}%;background:var(--amber)"></div></div>
      <span class="bar-val">${h.byHealth.at_risk}</span>
    </div>
    <div class="bar-row">
      <span class="bar-label">Churned</span>
      <div class="bar-track"><div class="bar-fill" style="width:${(h.byHealth.churned/store.state.accounts.length*100).toFixed(0)}%;background:var(--red)"></div></div>
      <span class="bar-val">${h.byHealth.churned}</span>
    </div>
  `;
  document.getElementById("summary-health-mini").innerHTML = healthHtml;
}
