// Northstar Ops Console — Shared filter, sort, and view state.
// Lightweight observable state: subscribers are called on every change.

const DAY_MS = 86400000;
const NOW_TS = Date.now();

export const DEFAULT_SORT = {
  revenue: { field: "net", dir: "desc" },
  tickets: { field: "created_at", dir: "desc" },
  incidents: { field: "opened_at", dir: "desc" },
  deployments: { field: "started_at", dir: "desc" },
  experiments: { field: "started_at", dir: "desc" },
  health: { field: "mrr", dir: "desc" },
};

export class FilterState {
  constructor() {
    this._subs = [];
    this._state = {
      dateRange: { from: NOW_TS - 90 * DAY_MS, to: NOW_TS },
      selectedAccountId: null,
      ticketStatuses: ["open", "in_progress", "pending_customer"],
      ticketPriorities: ["low", "normal", "high", "critical"],
      incidentSeverities: ["sev0", "sev1", "sev2", "sev3"],
      incidentStatuses: ["investigating", "mitigating", "resolved"],
      experimentStatuses: ["running", "concluded", "draft"],
      deployEnvironments: ["staging", "canary", "production"],
      deployStatuses: ["pending", "in_progress", "completed", "rolled_back"],
      savedViews: {},
      sort: { ...DEFAULT_SORT },
    };
  }

  get(key) { return this._state[key]; }

  set(key, value) {
    this._state[key] = value;
    this._notify(key);
  }

  subscribe(fn) { this._subs.push(fn); return () => { this._subs = this._subs.filter(s => s !== fn); }; }

  _notify(changedKey) {
    for (const fn of this._subs) fn(changedKey, this._state);
  }

  // ---- Derived filter helpers ----

  filterByDate(events, tsField) {
    const { from, to } = this._state.dateRange;
    return events.filter(e => e[tsField] >= from && e[tsField] <= to);
  }

  filterTickets(tickets) {
    return tickets.filter(t =>
      this._state.ticketStatuses.includes(t.status) &&
      this._state.ticketPriorities.includes(t.priority)
    );
  }

  filterIncidents(incidents) {
    return incidents.filter(i =>
      this._state.incidentSeverities.includes(i.severity) &&
      (this._state.incidentStatuses.includes(i.status) ||
       (this._state.incidentStatuses.includes("resolved") && i.status === "resolved"))
    );
  }

  filterExperiments(experiments) {
    return experiments.filter(e => this._state.experimentStatuses.includes(e.status));
  }

  filterDeployments(deployments) {
    return deployments.filter(d =>
      this._state.deployEnvironments.includes(d.environment) &&
      this._state.deployStatuses.includes(d.status)
    );
  }

  sortBy(items, field, dir = "desc") {
    const sorted = [...items];
    sorted.sort((a, b) => {
      const av = a[field], bv = b[field];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string") return dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return dir === "asc" ? av - bv : bv - av;
    });
    return sorted;
  }

  getSort(section) {
    return this._state.sort[section] || { field: null, dir: "desc" };
  }

  setSort(section, field, dir) {
    const sort = { ...this._state.sort };
    sort[section] = { field, dir };
    this.set("sort", sort);
  }

  // ---- Saved views ----

  saveView(name) {
    const views = { ...this._state.savedViews };
    views[name] = JSON.parse(JSON.stringify(this._state));
    this._state.savedViews = views;
    this._notify("savedViews");
  }

  loadView(name) {
    const views = this._state.savedViews;
    if (!views[name]) return false;
    const saved = views[name];
    for (const [k, v] of Object.entries(saved)) {
      if (k === "savedViews") continue;
      this._state[k] = v;
    }
    this._notify("loaded");
    return true;
  }

  deleteView(name) {
    const views = { ...this._state.savedViews };
    delete views[name];
    this.set("savedViews", views);
  }
}
