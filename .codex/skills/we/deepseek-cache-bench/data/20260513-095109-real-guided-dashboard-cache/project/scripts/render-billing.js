// Billing Ops renderer — aging, dunning, failed payments, leakage, credit memos, tax, cash forecast.
import { FMT } from "./format.js";
import { ageInvoices, agingSummary, atRiskAccounts } from "./billing/invoice-aging.js";
import { prioritizeDunning, dunningSummary } from "./billing/dunning-prioritization.js";
import { analyzeFailedPayments, failedPaymentSummary } from "./billing/failed-payment-routing.js";
import { detectLeakage, leakageSummary } from "./billing/revenue-leakage.js";
import { batchEvaluate, creditMemoSummary } from "./billing/credit-memo-rules.js";
import { batchScoreTaxRisks, taxRiskSummary } from "./billing/tax-risk-scoring.js";
import { correlateIncidentsToBilling, billingIncidentSummary } from "./billing/incident-billing-correlation.js";
import { forecastCollections, collectionForecastSummary } from "./billing/cash-collection-forecast.js";

export function renderBilling(store, fixtures, filterState) {
  const allFixtures = { ...fixtures, ...(store.state.fixtures || {}) };
  const accounts = store.state.accounts;
  const invoices = allFixtures.invoices || [];
  const contracts = allFixtures.contracts || {};
  const contractTerms = allFixtures.contractTerms || {};
  const paymentHistory = allFixtures.paymentHistory || {};
  const paymentAttempts = allFixtures.paymentAttempts || [];
  const creditMemos = allFixtures.creditMemos || [];
  const taxProfiles = allFixtures.taxProfiles || {};
  const billingContacts = allFixtures.billingContacts || {};
  const entitlementMismatches = allFixtures.entitlementMismatches || [];
  const incidents = store.state.incidents;
  const incidentImpactMap = allFixtures.incidentAccountImpact || {};

  // Invoice aging
  const buckets = ageInvoices(invoices);
  const aging = agingSummary(buckets);
  const atRisk = atRiskAccounts(buckets);

  // Dunning queue
  const dunningQueue = prioritizeDunning(atRisk, accounts, paymentHistory, billingContacts);
  const dunSum = dunningSummary(dunningQueue);

  // Failed payments
  const failedPayments = analyzeFailedPayments(paymentAttempts, invoices, accounts);
  const fpSum = failedPaymentSummary(failedPayments);

  // Revenue leakage
  const leaks = detectLeakage(accounts, invoices, contracts, entitlementMismatches);
  const leakSum = leakageSummary(leaks);

  // Credit memos
  const pendingCreditMemos = creditMemos.filter(cm => cm.status === "pending");
  const creditEvals = batchEvaluate(pendingCreditMemos, accounts, invoices, paymentHistory);
  const cmSum = creditMemoSummary(creditEvals);

  // Tax risk
  const taxScored = batchScoreTaxRisks(accounts, taxProfiles, contractTerms);
  const taxSum = taxRiskSummary(taxScored);

  // Billing-incident correlation
  const billingIncCorr = correlateIncidentsToBilling(incidents, creditMemos, paymentAttempts.filter(p => p.status === "failed"), incidentImpactMap);
  const bicSum = billingIncidentSummary(billingIncCorr);

  // Cash collection forecast
  const cashForecast = forecastCollections(atRisk, accounts, paymentHistory);
  const cfSum = collectionForecastSummary(cashForecast);

  // ---- HTML ----
  let html = "";

  // KPI cards
  html += `
    <div class="card-grid">
      <div class="card"><div class="card-label">Outstanding AR</div><div class="card-value">${FMT.currency(aging.total_outstanding)}</div></div>
      <div class="card"><div class="card-label">Overdue AR</div><div class="card-value amber">${FMT.currency(aging.total_overdue)}</div></div>
      <div class="card"><div class="card-label">90+ Days</div><div class="card-value red">${aging.aging_90_plus.count}</div></div>
      <div class="card"><div class="card-label">Dunning Queue</div><div class="card-value amber">${dunSum.total_in_dunning}</div></div>
      <div class="card"><div class="card-label">Failed Payments</div><div class="card-value red">${fpSum.total_accounts}</div></div>
      <div class="card"><div class="card-label">Revenue Leakage (yr)</div><div class="card-value red">${FMT.currency(leakSum.total_annual_leakage)}</div></div>
      <div class="card"><div class="card-label">Credit Requests</div><div class="card-value amber">${cmSum.total_requests}</div></div>
      <div class="card"><div class="card-label">Tax Flags (High)</div><div class="card-value ${taxSum.high_risk > 0 ? 'red' : ''}">${taxSum.high_risk}</div></div>
    </div>
  `;

  // ---- Two-col: Aging + Dunning ----
  html += `<div class="two-col">`;

  // Invoice Aging
  html += `
    <div class="panel">
      <h3>Invoice Aging</h3>
      <div class="bar-row"><span class="bar-label">Current</span><div class="bar-track"><div class="bar-fill" style="width:${pctBar(aging.current.amount, aging.total_outstanding + aging.paid.amount)}%;background:var(--green)"></div></div><span class="bar-val">${FMT.currency(aging.current.amount)}</span></div>
      <div class="bar-row"><span class="bar-label">1-30 Days</span><div class="bar-track"><div class="bar-fill" style="width:${pctBar(aging.aging_1_30.amount, aging.total_outstanding + aging.paid.amount)}%;background:var(--amber)"></div></div><span class="bar-val">${FMT.currency(aging.aging_1_30.amount)}</span></div>
      <div class="bar-row"><span class="bar-label">31-60 Days</span><div class="bar-track"><div class="bar-fill" style="width:${pctBar(aging.aging_31_60.amount, aging.total_outstanding + aging.paid.amount)}%;background:var(--amber)"></div></div><span class="bar-val">${FMT.currency(aging.aging_31_60.amount)}</span></div>
      <div class="bar-row"><span class="bar-label">61-90 Days</span><div class="bar-track"><div class="bar-fill" style="width:${pctBar(aging.aging_61_90.amount, aging.total_outstanding + aging.paid.amount)}%;background:var(--red)"></div></div><span class="bar-val">${FMT.currency(aging.aging_61_90.amount)}</span></div>
      <div class="bar-row"><span class="bar-label">90+ Days</span><div class="bar-track"><div class="bar-fill" style="width:${pctBar(aging.aging_90_plus.amount, aging.total_outstanding + aging.paid.amount)}%;background:var(--red)"></div></div><span class="bar-val">${FMT.currency(aging.aging_90_plus.amount)}</span></div>
    </div>
  `;

  // Dunning Queue
  html += `
    <div class="panel">
      <h3>Dunning Queue (${dunSum.total_in_dunning})</h3>
      <div class="table-wrap">
        <table><thead><tr><th>Account</th><th>Due</th><th>Days</th><th>Tier</th><th>Score</th><th>Action</th></tr></thead><tbody>
        ${dunningQueue.slice(0, 8).map(d => `
          <tr class="billing-row" data-account-id="${d.account_id}" style="cursor:pointer">
            <td>${d.account_name}</td>
            <td>${FMT.currency(d.total_due)}</td>
            <td style="color:var(--red);font-weight:600">${d.max_days_overdue}d</td>
            <td><span class="tag ${d.tier === 'urgent' ? 'tag-sev0' : d.tier === 'high' ? 'tag-at-risk' : 'tag-running'}">${d.tier}</span></td>
            <td><strong>${d.score}</strong></td>
            <td style="font-size:11px;color:var(--text-dim)">${d.recommended_action.slice(0, 45)}…</td>
          </tr>
        `).join("")}
        </tbody></table>
      </div>
    </div>
  `;

  html += `</div>`;

  // ---- Two-col: Failed Payments + Revenue Leakage ----
  html += `<div class="two-col">`;

  // Failed Payments
  html += `
    <div class="panel">
      <h3>Failed Payments (${fpSum.total_accounts} accounts)</h3>
      <div class="table-wrap">
        <table><thead><tr><th>Account</th><th>Attempts</th><th>Due</th><th>Reason</th><th>Route</th></tr></thead><tbody>
        ${failedPayments.slice(0, 6).map(f => `
          <tr class="billing-row" data-account-id="${f.account_id}" style="cursor:pointer">
            <td>${f.account_name}</td>
            <td style="color:var(--red)">${f.failed_attempts}</td>
            <td>${FMT.currency(f.total_due)}</td>
            <td><span style="font-size:11px">${f.primary_reason.replace(/_/g, ' ')}</span></td>
            <td style="font-size:11px;color:var(--text-dim)">${f.route}</td>
          </tr>
        `).join("")}
        </tbody></table>
      </div>
    </div>
  `;

  // Revenue Leakage
  html += `
    <div class="panel">
      <h3>Revenue Leakage (${leakSum.total_accounts_with_leaks} accounts, ${FMT.currency(leakSum.total_annual_leakage)}/yr)</h3>
      <div class="table-wrap">
        <table><thead><tr><th>Account</th><th>Type</th><th>Monthly</th><th>Annual</th></tr></thead><tbody>
        ${leaks.slice(0, 8).map(l => `
          <tr class="billing-row" data-account-id="${l.account_id}" style="cursor:pointer">
            <td>${l.account_name}</td>
            <td style="font-size:11px">${l.items.map(i => i.type.replace(/_/g, ' ')).join(" · ")}</td>
            <td style="color:var(--red)">${FMT.currency(l.total_monthly_leakage)}</td>
            <td style="color:var(--red)">${FMT.currency(l.total_annual_leakage)}</td>
          </tr>
        `).join("")}
        </tbody></table>
      </div>
    </div>
  `;

  html += `</div>`;

  // ---- Two-col: Credit Memos + Tax Risk ----
  html += `<div class="two-col">`;

  // Credit Memos
  html += `
    <div class="panel">
      <h3>Credit Memo Requests (${cmSum.total_requests} pending)</h3>
      <div class="table-wrap">
        <table><thead><tr><th>Account</th><th>Amount</th><th>Decision</th><th>Approver</th></tr></thead><tbody>
        ${creditEvals.slice(0, 6).map(ev => `
          <tr>
            <td>${ev.account_name}</td>
            <td>${FMT.currency(ev.amount)}</td>
            <td><span class="tag ${ev.decision === 'auto_approve' ? 'tag-healthy' : ev.decision === 'deny' ? 'tag-sev0' : 'tag-running'}">${ev.decision.replace(/_/g,' ')}</span></td>
            <td>${ev.approver_level}</td>
          </tr>
        `).join("")}
        </tbody></table>
      </div>
    </div>
  `;

  // Tax Risk
  html += `
    <div class="panel">
      <h3>Tax Compliance Risk</h3>
      <div class="table-wrap">
        <table><thead><tr><th>Account</th><th>Risk</th><th>Score</th><th>Flags</th></tr></thead><tbody>
        ${taxScored.filter(t => t.risk_score > 0).slice(0, 7).map(t => `
          <tr>
            <td>${t.account_name}</td>
            <td><span class="tag ${t.risk_level === 'high' ? 'tag-sev0' : t.risk_level === 'medium' ? 'tag-at-risk' : 'tag-healthy'}">${t.risk_level}</span></td>
            <td><strong>${t.risk_score}</strong></td>
            <td style="font-size:11px">${t.flags.map(f => f.type.replace(/_/g,' ')).join(" · ") || "—"}</td>
          </tr>
        `).join("")}
        </tbody></table>
      </div>
    </div>
  `;

  html += `</div>`;

  // ---- Cash Collections Forecast ----
  html += `
    <div class="panel">
      <h3>Cash Collection Forecast</h3>
      <div class="metric-row" style="margin-bottom:12px">
        <div class="metric-item"><span class="metric-label">Outstanding</span><span class="metric-value">${FMT.currency(cfSum.total_outstanding)}</span></div>
        <div class="metric-item"><span class="metric-label">Expected (7d)</span><span class="metric-value" style="color:var(--green)">${FMT.currency(cfSum.expected_7d)}</span></div>
        <div class="metric-item"><span class="metric-label">Expected (30d)</span><span class="metric-value" style="color:var(--accent)">${FMT.currency(cfSum.expected_30d)}</span></div>
        <div class="metric-item"><span class="metric-label">Recovery Rate</span><span class="metric-value">${cfSum.expected_recovery_pct}%</span></div>
        <div class="metric-item"><span class="metric-label">At Risk</span><span class="metric-value" style="color:var(--red)">${FMT.currency(cfSum.at_risk_amount)}</span></div>
      </div>
      <div class="bar-row"><span class="bar-label">7 Days</span><div class="bar-track"><div class="bar-fill" style="width:${pctBar(cashForecast.next_7_days.amount, cfSum.total_outstanding)}%;background:var(--green)"></div></div><span class="bar-val">${FMT.currency(cashForecast.next_7_days.amount)}</span></div>
      <div class="bar-row"><span class="bar-label">30 Days</span><div class="bar-track"><div class="bar-fill" style="width:${pctBar(cashForecast.next_30_days.amount, cfSum.total_outstanding)}%;background:var(--accent)"></div></div><span class="bar-val">${FMT.currency(cashForecast.next_30_days.amount)}</span></div>
      <div class="bar-row"><span class="bar-label">60 Days</span><div class="bar-track"><div class="bar-fill" style="width:${pctBar(cashForecast.next_60_days.amount, cfSum.total_outstanding)}%;background:var(--amber)"></div></div><span class="bar-val">${FMT.currency(cashForecast.next_60_days.amount)}</span></div>
      <div class="bar-row"><span class="bar-label">90 Days</span><div class="bar-track"><div class="bar-fill" style="width:${pctBar(cashForecast.next_90_days.amount, cfSum.total_outstanding)}%;background:var(--red)"></div></div><span class="bar-val">${FMT.currency(cashForecast.next_90_days.amount)}</span></div>
    </div>
  `;

  // ---- Billing-Incident Correlation ----
  if (billingIncCorr.length > 0) {
    html += `
      <div class="panel">
        <h3>Billing Impact from Incidents</h3>
        <div class="table-wrap">
          <table><thead><tr><th>Incident</th><th>Severity</th><th>Credits</th><th>Failed Pmts</th><th>Total Impact</th></tr></thead><tbody>
          ${billingIncCorr.slice(0, 5).map(c => `
            <tr>
              <td style="font-size:12px">${c.incident_title.slice(0, 50)}</td>
              <td><span class="tag ${FMT.tagClass(c.severity)}">${c.severity}</span></td>
              <td>${c.credit_memos_issued} (${FMT.currency(c.total_credit_amount)})</td>
              <td>${c.payment_failures_triggered} (${FMT.currency(c.total_failed_amount)})</td>
              <td style="color:var(--red);font-weight:600">${FMT.currency(c.total_billing_impact)}</td>
            </tr>
          `).join("")}
          </tbody></table>
        </div>
      </div>
    `;
  }

  document.getElementById("billing-content").innerHTML = html;

  document.querySelectorAll(".billing-row").forEach(row => {
    row.addEventListener("click", () => {
      const accountId = row.dataset.accountId;
      if (accountId) filterState.set("selectedAccountId", accountId);
    });
  });
}

function pctBar(val, max) {
  if (max <= 0) return 0;
  return Math.min(100, (val / max * 100)).toFixed(0);
}
