// Northstar Ops Console — Main application controller

// ---- Imports ----
import { seedAll } from "../data/seed.js";
import { createStore } from "../data/store.js";
import { seedAllFixtures } from "../data/fixtures.js";
import { seedAllCSFixtures } from "../data/fixtures-cs.js";
import { seedAllCommandFixtures } from "../data/fixtures-command.js";
import { seedAllBillingFixtures } from "../data/fixtures-billing.js";
import { seedAllForecastFixtures } from "../data/fixtures-forecast.js";
import { seedAllUsageFixtures } from "../data/fixtures-usage.js";
import { FilterState } from "../data/filters.js";
import {
  buildFilterBar, setRerenderCallback, populateAccountSelect,
  updateSortSelects, updateFilterToggles,
} from "../scripts/ui-controls.js";
import { renderSummary } from "../scripts/render-summary.js";
import { renderRevenue } from "../scripts/render-revenue.js";
import { renderFunnel } from "../scripts/render-funnel.js";
import { renderRetention } from "../scripts/render-retention.js";
import { renderHealth } from "../scripts/render-health.js";
import { renderSupport } from "../scripts/render-support.js";
import { renderIncidents } from "../scripts/render-incidents.js";
import { renderExperiments } from "../scripts/render-experiments.js";
import { renderDeployments } from "../scripts/render-deployments.js";
import { renderBilling } from "../scripts/render-billing.js";
import { renderForecasts } from "../scripts/render-forecasts.js";
import { renderUsage } from "../scripts/render-usage.js";
import { renderAccountDetail } from "../scripts/render-account-detail.js";
import { renderPortfolio } from "../scripts/render-portfolio.js";
import { renderRenewals } from "../scripts/render-renewals.js";
import { renderCommand } from "../scripts/render-command.js";

// ---- Bootstrap: data, fixtures, state ----
const seedData = seedAll();
const store = createStore(seedData);

const baseFixtures = seedAllFixtures(store.state);
const csFixtures = seedAllCSFixtures(store.state, baseFixtures.contracts);
const commandFixtures = seedAllCommandFixtures(store.state);
const billingFixtures = seedAllBillingFixtures(store.state, baseFixtures);
const forecastFixtures = seedAllForecastFixtures();
const usageFixtures = seedAllUsageFixtures(store.state);
const fixtures = {
  ...baseFixtures, ...csFixtures, ...commandFixtures,
  ...billingFixtures, ...forecastFixtures, ...usageFixtures,
};
store.attachFixtures(fixtures);

const filterState = new FilterState();

// ---- Section metadata ----
const TITLES = {
  summary: "Summary",
  revenue: "Revenue",
  funnel: "Acquisition Funnel",
  retention: "Retention Cohorts",
  health: "Customer Health",
  support: "Support Queue",
  incidents: "Incidents",
  experiments: "Experiments",
  deployments: "Deployments",
  billing: "Billing Operations",
  forecasts: "Executive Forecasts",
  usage: "Usage Operations",
  account: "Account Detail",
  portfolio: "Customer Portfolio",
  renewals: "Renewal Workbench",
  command: "Command Center",
};

const RENDERERS = {
  summary:      (s, f, fs) => renderSummary(s),
  revenue:      (s, f, fs) => renderRevenue(s),
  funnel:       (s, f, fs) => renderFunnel(s),
  retention:    (s, f, fs) => renderRetention(s),
  health:       (s, f, fs) => renderHealthWithFilters(s, f, fs),
  support:      (s, f, fs) => renderSupportWithFilters(s, f, fs),
  incidents:    (s, f, fs) => renderIncidentsWithFilters(s, f, fs),
  experiments:  (s, f, fs) => renderExperimentsWithFilters(s, f, fs),
  deployments:  (s, f, fs) => renderDeploymentsWithFilters(s, f, fs),
  billing:      (s, f, fs) => renderBilling(s, f, fs),
  forecasts:    (s, f, fs) => renderForecasts(s, f, fs),
  usage:        (s, f, fs) => renderUsage(s, f, fs),
  account:      (s, f, fs) => renderAccountDetail(s, f, fs),
  portfolio:    (s, f, fs) => renderPortfolio(s, f, fs),
  renewals:     (s, f, fs) => renderRenewals(s, f, fs),
  command:      (s, f, fs) => renderCommand(s, f, fs),
};

const SORT_FIELDS = {
  summary: null,
  revenue: null,
  funnel: null,
  retention: null,
  health: [
    { value: "mrr", label: "MRR" },
    { value: "name", label: "Name" },
    { value: "usage_pct", label: "Usage" },
  ],
  support: [
    { value: "created_at", label: "Created" },
    { value: "priority", label: "Priority" },
  ],
  incidents: [
    { value: "opened_at", label: "Opened" },
    { value: "severity", label: "Severity" },
    { value: "duration_m", label: "Duration" },
  ],
  experiments: [
    { value: "started_at", label: "Started" },
    { value: "lift_pct", label: "Lift" },
    { value: "confidence", label: "Confidence" },
  ],
  deployments: [
    { value: "started_at", label: "Started" },
    { value: "risk_score", label: "Risk" },
    { value: "environment", label: "Env" },
  ],
  billing: null,
  forecasts: null,
  usage: null,
  account: null,
  portfolio: null,
  renewals: null,
  command: null,
};

let currentSection = "summary";
let filterBarElements = null;

// ---- Filter-aware render wrappers ----
function renderHealthWithFilters(store, fixtures, fs) {
  const filtered = { ...store.state };
  const sort = fs.getSort("health");
  if (sort.field) {
    filtered.accounts = fs.sortBy([...store.state.accounts], sort.field, sort.dir);
  }
  renderHealth({ state: filtered, selectors: store.selectors });
}
function renderSupportWithFilters(store, fixtures, fs) {
  const allTickets = store.state.tickets;
  const dateFiltered = fs.filterByDate(allTickets, "created_at");
  const statusFiltered = fs.filterTickets(dateFiltered);
  const sort = fs.getSort("tickets");
  const sorted = fs.sortBy(statusFiltered, sort.field, sort.dir);
  const filtered = { ...store.state, tickets: sorted };
  const tempStore = {
    state: filtered,
    selectors: {
      ...store.selectors,
      supportSummary() {
        const open = sorted.filter(t => t.status !== "resolved");
        const byStatus = {}, byPriority = {}, byAssignee = {};
        for (const t of sorted) {
          byStatus[t.status] = (byStatus[t.status] || 0) + 1;
          byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
          if (t.assignee) byAssignee[t.assignee] = (byAssignee[t.assignee] || 0) + 1;
        }
        const resolved = sorted.filter(t => t.resolved_at);
        const avgH = resolved.length
          ? resolved.reduce((s, t) => s + (t.resolved_at - t.created_at) / 3600000, 0) / resolved.length
          : null;
        return { byStatus, byPriority, byAssignee, openTickets: open, avgResolutionH: avgH };
      },
    },
  };
  renderSupport(tempStore);
}
function renderIncidentsWithFilters(store, fixtures, fs) {
  const allInc = store.state.incidents;
  const dateFiltered = fs.filterByDate(allInc, "opened_at");
  const filtered = fs.filterIncidents(dateFiltered);
  const sort = fs.getSort("incidents");
  const sorted = fs.sortBy(filtered, sort.field, sort.dir);
  const tempState = { ...store.state, incidents: sorted };
  const tempStore = {
    state: tempState,
    selectors: {
      ...store.selectors,
      incidentSummary() {
        const bySeverity = {}, byStatus = {};
        for (const inc of sorted) {
          bySeverity[inc.severity] = (bySeverity[inc.severity] || 0) + 1;
          byStatus[inc.status] = (byStatus[inc.status] || 0) + 1;
        }
        const openInc = sorted.filter(
          i => i.status !== "closed" && i.status !== "resolved"
        );
        const closed = sorted.filter(i => i.duration_m != null);
        const mttrM = closed.length
          ? closed.reduce((s, i) => s + i.duration_m, 0) / closed.length
          : null;
        return { bySeverity, byStatus, openIncidents: openInc, mttrM };
      },
    },
  };
  renderIncidents(tempStore);
}
function renderExperimentsWithFilters(store, fixtures, fs) {
  const filtered = fs.filterExperiments(store.state.experiments);
  const sort = fs.getSort("experiments");
  const sorted = fs.sortBy(filtered, sort.field, sort.dir);
  const tempState = { ...store.state, experiments: sorted };
  renderExperiments({
    state: tempState,
    selectors: { ...store.selectors, experimentSummary() { return sorted; } },
  });
}
function renderDeploymentsWithFilters(store, fixtures, fs) {
  const allDep = store.state.deployments;
  const dateFiltered = fs.filterByDate(allDep, "started_at");
  const filtered = fs.filterDeployments(dateFiltered);
  const sort = fs.getSort("deployments");
  const sorted = fs.sortBy(filtered, sort.field, sort.dir);
  const tempState = { ...store.state, deployments: sorted };
  const tempStore = {
    state: tempState,
    selectors: {
      ...store.selectors,
      deploymentSummary() {
        const byEnv = {}, byService = {};
        for (const d of sorted) {
          if (!byEnv[d.environment]) {
            byEnv[d.environment] = {
              total: 0, completed: 0, rolled_back: 0, in_progress: 0,
            };
          }
          byEnv[d.environment].total += 1;
          if (d.status === "completed") byEnv[d.environment].completed += 1;
          if (d.status === "rolled_back") byEnv[d.environment].rolled_back += 1;
          if (d.status === "in_progress") byEnv[d.environment].in_progress += 1;
          if (!byService[d.service]) {
            byService[d.service] = { total: 0, avg_risk: 0, deployments: [] };
          }
          byService[d.service].total += 1;
          byService[d.service].deployments.push(d);
        }
        for (const svc of Object.values(byService)) {
          svc.avg_risk = svc.deployments.length
            ? svc.deployments.reduce((s, d) => s + d.risk_score, 0) / svc.deployments.length
            : 0;
        }
        return { byEnv, byService, recent: sorted.slice(0, 10) };
      },
    },
  };
  renderDeployments(tempStore);
}

// ---- Navigation ----
function navigate(section) {
  if (!RENDERERS[section]) return;
  currentSection = section;
  document.querySelectorAll(".sidebar-nav a").forEach(a => {
    a.classList.remove("active");
  });
  const link = document.querySelector(`[data-section="${section}"]`);
  if (link) link.classList.add("active");
  document.querySelectorAll(".content").forEach(el => {
    el.classList.remove("active");
  });
  const secEl = document.getElementById(`section-${section}`);
  if (secEl) secEl.classList.add("active");
  document.getElementById("section-title").textContent =
    TITLES[section] || section;
  if (filterBarElements) {
    updateSortSelectsForSection(section);
    updateFilterToggles(filterState, section);
  }
  RENDERERS[section](store, fixtures, filterState);
}
function updateSortSelectsForSection(section) {
  const { sortField } = filterBarElements;
  if (!sortField) return;
  sortField.querySelectorAll("option").forEach(o => o.remove());
  const fields = SORT_FIELDS[section] || [];
  for (const f of fields) {
    sortField.appendChild(
      Object.assign(document.createElement("option"), {
        value: f.value, textContent: f.label,
      })
    );
  }
  const current = filterState.getSort(section);
  if (current.field) sortField.value = current.field;
  else if (fields.length) sortField.value = fields[0].value;
}

// ---- Account selection → account detail ----
filterState.subscribe((key) => {
  if (key !== "selectedAccountId") return;
  const id = filterState.get("selectedAccountId");
  if (id && currentSection !== "account") {
    if (!document.querySelector('[data-section="account"]')) {
      const nav = document.querySelector(".sidebar-nav");
      const a = document.createElement("a");
      a.href = "#account";
      a.dataset.section = "account";
      a.innerHTML = '<span class="nav-icon">🔍</span> Account Detail';
      a.addEventListener("click", (e) => {
        e.preventDefault();
        navigate("account");
        window.location.hash = "account";
      });
      nav.appendChild(a);
    }
    navigate("account");
  } else if (!id && currentSection === "account") {
    navigate("summary");
  }
});

// ---- Rerender callback ----
setRerenderCallback(() => {
  if (currentSection === "account") {
    renderAccountDetail(store, fixtures, filterState);
  } else if (currentSection === "portfolio") {
    renderPortfolio(store, fixtures, filterState);
  } else if (currentSection === "renewals") {
    renderRenewals(store, fixtures, filterState);
  } else if (currentSection === "command") {
    renderCommand(store, fixtures, filterState);
  } else if (currentSection === "billing") {
    renderBilling(store, fixtures, filterState);
  } else if (currentSection === "forecasts") {
    renderForecasts(store, fixtures, filterState);
  } else if (currentSection === "usage") {
    renderUsage(store, fixtures, filterState);
  } else {
    navigate(currentSection);
  }
});

// ---- Sidebar navigation ----
document.querySelectorAll(".sidebar-nav a").forEach(link => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const section = link.dataset.section;
    if (!section) return;
    if (section !== "account") filterState.set("selectedAccountId", null);
    navigate(section);
    window.location.hash = section;
  });
});
window.addEventListener("hashchange", () => {
  const hash = window.location.hash.replace("#", "");
  if (hash && RENDERERS[hash]) navigate(hash);
});

// ---- Badges ----
function updateBadges() {
  const supBadge = document.getElementById("support-badge");
  const incBadge = document.getElementById("incident-badge");
  const renBadge = document.getElementById("renewals-badge");
  const cmdBadge = document.getElementById("command-badge");
  if (supBadge) {
    supBadge.textContent = store.state.tickets.filter(
      t => t.status !== "resolved"
    ).length;
  }
  if (incBadge) {
    incBadge.textContent = store.state.incidents.filter(
      i => i.status !== "closed" && i.status !== "resolved"
    ).length;
  }
  if (renBadge) {
    const contracts = fixtures.contracts || {};
    const now = Date.now(), DAY = 86400000;
    const imminent = store.state.accounts.filter(a => {
      const c = contracts[a.id];
      return c && c.renewal_date &&
        (c.renewal_date - now) / DAY <= 30 &&
        a.health !== "churned";
    }).length;
    renBadge.textContent = imminent;
  }
  if (cmdBadge) {
    cmdBadge.textContent = store.state.incidents.filter(
      i => i.status !== "closed" && i.status !== "resolved"
    ).length;
  }
}

// ---- Clock ----
function updateClock() {
  document.getElementById("clock").textContent =
    new Date().toLocaleString("en-US", {
      month: "short", day: "numeric", hour: "2-digit",
      minute: "2-digit", second: "2-digit", hour12: false,
    });
}

// ---- Init ----
(function init() {
  const barContainer = document.getElementById("filter-bar-container");
  if (barContainer) {
    const { bar, acctSel, sortField, sortDir, viewSel, populateViews } =
      buildFilterBar(filterState);
    barContainer.appendChild(bar);
    filterBarElements = { sortField, sortDir, viewSel };
    populateAccountSelect(acctSel, store.state.accounts);
    populateViews();
    sortField.addEventListener("change", () => {
      filterState.setSort(currentSection, sortField.value, sortDir.value);
      navigate(currentSection);
    });
    sortDir.addEventListener("change", () => {
      filterState.setSort(currentSection, sortField.value, sortDir.value);
      navigate(currentSection);
    });
    filterState.subscribe((key) => {
      if (key === "savedViews" || key === "loaded") populateViews();
    });
  }
  updateBadges();
  updateClock();
  setInterval(updateClock, 30000);
  setInterval(updateBadges, 60000);
  const hash = window.location.hash.replace("#", "");
  navigate(hash && RENDERERS[hash] ? hash : "summary");
})();
