// Northstar Ops Console — Central store with derived selectors.
// All state is read from a plain object; no framework needed.

const NOW_TS = Date.now();
const DAY_MS = 86400000;
const MONTH_MS = DAY_MS * 30;

export function createStore(seedData) {
  const state = { ...seedData, fixtures: {} };

  function attachFixtures(fixtures) {
    state.fixtures = fixtures;
  }

  const selectors = {
    // ---- Summary KPIs ----
    summaryKpis() {
      const accounts = state.accounts;
      const active = accounts.filter(a => a.health !== "churned");
      const totalMrr = active.reduce((s, a) => s + a.mrr, 0);
      const atRisk = accounts.filter(a => a.health === "at_risk");
      const churned = accounts.filter(a => a.health === "churned");
      const healthy = accounts.filter(a => a.health === "healthy");
      const openTickets = state.tickets.filter(t => t.status !== "resolved");
      const openIncidents = state.incidents.filter(i => i.status !== "closed" && i.status !== "resolved");

      const prevMonthMrr = active.reduce((s, a) => s + a.mrr, 0) - active.length * 45;
      const mrrGrowth = totalMrr > 0 ? ((totalMrr - prevMonthMrr) / prevMonthMrr * 100) : 0;

      return {
        total_mrr: totalMrr,
        arr: totalMrr * 12,
        active_accounts: active.length,
        churn_rate: active.length > 0 ? churned.length / (active.length + churned.length) * 100 : 0,
        mrr_growth_pct: mrrGrowth,
        healthy_pct: accounts.length > 0 ? healthy.length / accounts.length * 100 : 0,
        at_risk_count: atRisk.length,
        open_tickets: openTickets.length,
        critical_tickets: openTickets.filter(t => t.priority === "critical").length,
        open_incidents: openIncidents.length,
        active_experiments: state.experiments.filter(e => e.status === "running").length,
        avg_ticket_satisfaction: (() => {
          const scored = state.tickets.filter(t => t.satisfaction_score != null);
          return scored.length ? scored.reduce((s, t) => s + t.satisfaction_score, 0) / scored.length : null;
        })(),
        deployments_today: state.deployments.filter(d => d.started_at > NOW_TS - DAY_MS).length,
      };
    },

    // ---- Revenue ----
    revenueByMonth() {
      const months = {};
      for (const ev of state.revenue_events) {
        const d = new Date(ev.timestamp);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (!months[key]) months[key] = { mrr: 0, upgrades: 0, cancellations: 0, net: 0 };
        if (ev.type === "charge") months[key].mrr += ev.amount;
        else if (ev.type === "upgrade_addon") months[key].upgrades += ev.amount;
        else if (ev.type === "cancellation") months[key].cancellations += ev.amount;
        months[key].net = months[key].mrr + months[key].upgrades + months[key].cancellations;
      }
      return Object.entries(months)
        .map(([month, v]) => ({ month, ...v }))
        .sort((a, b) => a.month.localeCompare(b.month));
    },

    revenueByPlan() {
      const plans = {};
      for (const acct of state.accounts) {
        if (acct.health === "churned") continue;
        if (!plans[acct.plan]) plans[acct.plan] = { accounts: 0, mrr: 0 };
        plans[acct.plan].accounts += 1;
        plans[acct.plan].mrr += acct.mrr;
      }
      return Object.entries(plans).map(([plan, v]) => ({ plan, ...v }));
    },

    // ---- Funnel ----
    funnelByWeek() {
      const stages = ["visitors","signups","trials_started","activated","qualified","won"];
      const weeks = {};
      for (const row of state.funnel) {
        const w = `W${row.week}`;
        if (!weeks[w]) weeks[w] = {};
        weeks[w][row.stage] = row.count;
      }
      return Object.entries(weeks).map(([week, counts]) => {
        const entry = { week, ...counts };
        entry.conversion_to_won = entry.visitors ? (entry.won / entry.visitors * 100) : 0;
        return entry;
      }).sort((a, b) => a.week.localeCompare(b.week));
    },

    funnelCurrentRates() {
      const latest = state.funnel.reduce((best, row) => row.week > best.week ? row : best, state.funnel[0]);
      const byStage = {};
      for (const row of state.funnel) {
        if (row.week !== latest.week) continue;
        byStage[row.stage] = row.count;
      }
      return [
        { from: "visitors", to: "signups", rate: byStage.signups / byStage.visitors * 100 },
        { from: "signups", to: "trials_started", rate: byStage.trials_started / byStage.signups * 100 },
        { from: "trials_started", to: "activated", rate: byStage.activated / byStage.trials_started * 100 },
        { from: "activated", to: "qualified", rate: byStage.qualified / byStage.activated * 100 },
        { from: "qualified", to: "won", rate: byStage.won / byStage.qualified * 100 },
      ];
    },

    // ---- Retention ----
    retentionCohorts() {
      return state.retention_cohorts;
    },

    // ---- Customer Health ----
    healthSummary() {
      const byHealth = { healthy: 0, at_risk: 0, churned: 0 };
      const byPlan = {};
      const byIndustry = {};
      const atRiskAccounts = [];
      for (const acct of state.accounts) {
        byHealth[acct.health] = (byHealth[acct.health] || 0) + 1;
        if (!byPlan[acct.plan]) byPlan[acct.plan] = { healthy: 0, at_risk: 0, churned: 0 };
        byPlan[acct.plan][acct.health] += 1;
        if (!byIndustry[acct.industry]) byIndustry[acct.industry] = { healthy: 0, at_risk: 0, churned: 0 };
        byIndustry[acct.industry][acct.health] += 1;
        if (acct.health === "at_risk") atRiskAccounts.push(acct);
      }
      return { byHealth, byPlan, byIndustry, atRiskAccounts };
    },

    // ---- Support ----
    supportSummary() {
      const byStatus = {};
      const byPriority = {};
      const byAssignee = {};
      for (const t of state.tickets) {
        byStatus[t.status] = (byStatus[t.status] || 0) + 1;
        byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
        if (t.assignee) byAssignee[t.assignee] = (byAssignee[t.assignee] || 0) + 1;
      }
      const openTickets = state.tickets.filter(t => t.status !== "resolved");
      const avgResolutionH = (() => {
        const resolved = state.tickets.filter(t => t.resolved_at);
        return resolved.length
          ? resolved.reduce((s, t) => s + (t.resolved_at - t.created_at) / 3600000, 0) / resolved.length
          : null;
      })();
      return { byStatus, byPriority, byAssignee, openTickets, avgResolutionH };
    },

    // ---- Incidents ----
    incidentSummary() {
      const bySeverity = {};
      const byStatus = {};
      for (const inc of state.incidents) {
        bySeverity[inc.severity] = (bySeverity[inc.severity] || 0) + 1;
        byStatus[inc.status] = (byStatus[inc.status] || 0) + 1;
      }
      const openIncidents = state.incidents.filter(i => i.status !== "closed" && i.status !== "resolved");
      const mttrM = (() => {
        const closed = state.incidents.filter(i => i.duration_m != null);
        return closed.length ? closed.reduce((s, i) => s + i.duration_m, 0) / closed.length : null;
      })();
      return { bySeverity, byStatus, openIncidents, mttrM };
    },

    // ---- Experiments ----
    experimentSummary() {
      return state.experiments;
    },

    // ---- Deployments ----
    deploymentSummary() {
      const byEnv = {};
      const byService = {};
      for (const d of state.deployments) {
        if (!byEnv[d.environment]) byEnv[d.environment] = { total: 0, completed: 0, rolled_back: 0, in_progress: 0 };
        byEnv[d.environment].total += 1;
        if (d.status === "completed") byEnv[d.environment].completed += 1;
        if (d.status === "rolled_back") byEnv[d.environment].rolled_back += 1;
        if (d.status === "in_progress") byEnv[d.environment].in_progress += 1;
        if (!byService[d.service]) byService[d.service] = { total: 0, avg_risk: 0, deployments: [] };
        byService[d.service].total += 1;
        byService[d.service].deployments.push(d);
      }
      for (const svc of Object.values(byService)) {
        svc.avg_risk = svc.deployments.length
          ? svc.deployments.reduce((s, d) => s + d.risk_score, 0) / svc.deployments.length
          : 0;
      }
      const recent = [...state.deployments].slice(0, 10);
      return { byEnv, byService, recent };
    },
  };

  return { state, selectors, attachFixtures };
}
