// Northstar Ops Console — Filter bar, sort controls, saved views UI.

import { DEFAULT_SORT } from "../data/filters.js";

export function buildFilterBar(filterState, sections) {
  const bar = document.createElement("div");
  bar.className = "filter-bar";

  // Date range
  const dateWrap = ce("div", "filter-group");
  dateWrap.append(label("Date range"));
  const from = el("input", { type: "date", className: "filter-input" });
  const to = el("input", { type: "date", className: "filter-input" });
  from.value = tsToDate(filterState.get("dateRange").from);
  to.value = tsToDate(filterState.get("dateRange").to);
  from.addEventListener("change", () => { const dr = filterState.get("dateRange"); dr.from = dateToTs(from.value) || dr.from; filterState.set("dateRange", dr); rerenderSections(); });
  to.addEventListener("change", () => { const dr = filterState.get("dateRange"); dr.to = dateToTs(to.value) || dr.to; filterState.set("dateRange", dr); rerenderSections(); });
  dateWrap.append(from, to);
  bar.append(dateWrap);

  // Account selector
  const acctWrap = ce("div", "filter-group");
  acctWrap.append(label("Account"));
  const acctSel = el("select", { className: "filter-input" });
  acctSel.append(el("option", { value: "", textContent: "All accounts" }));
  acctSel.addEventListener("change", () => { filterState.set("selectedAccountId", acctSel.value || null); rerenderSections(); });
  acctWrap.append(acctSel);
  bar.append(acctWrap);

  // Sort
  const sortWrap = ce("div", "filter-group");
  sortWrap.append(label("Sort"));
  const sortField = el("select", { className: "filter-input filter-input-sm" });
  const sortDir = el("select", { className: "filter-input filter-input-sm" });
  sortDir.append(el("option", { value: "desc", textContent: "Desc" }));
  sortDir.append(el("option", { value: "asc", textContent: "Asc" }));
  sortField.addEventListener("change", () => { filterState.setSort(currentSection(), sortField.value, sortDir.value); rerenderSections(); });
  sortDir.addEventListener("change", () => { filterState.setSort(currentSection(), sortField.value, sortDir.value); rerenderSections(); });
  sortWrap.append(sortField, sortDir);
  bar.append(sortWrap);

  // Section-specific toggles
  const toggleWrap = ce("div", "filter-group filter-toggles");
  toggleWrap.id = "filter-toggles";
  bar.append(toggleWrap);

  // Saved views
  const viewWrap = ce("div", "filter-group");
  viewWrap.append(label("Views"));
  const viewSel = el("select", { className: "filter-input", id: "view-select" });
  viewSel.append(el("option", { value: "", textContent: "—" }));
  viewSel.addEventListener("change", () => { if (viewSel.value) { filterState.loadView(viewSel.value); rerenderSections(); } });
  viewWrap.append(viewSel);
  const saveBtn = el("button", { className: "btn btn-sm", textContent: "Save" });
  saveBtn.addEventListener("click", () => { const name = prompt("View name:"); if (name) { filterState.saveView(name); populateViewSelect(viewSel, filterState); } });
  viewWrap.append(saveBtn);
  const delBtn = el("button", { className: "btn btn-sm btn-ghost", textContent: "✕" });
  delBtn.addEventListener("click", () => { if (viewSel.value) { filterState.deleteView(viewSel.value); populateViewSelect(viewSel, filterState); } });
  viewWrap.append(delBtn);
  bar.append(viewWrap);

  // Populate accounts
  return { bar, acctSel, sortField, sortDir, viewSel, populateViews: () => populateViewSelect(viewSel, filterState) };
}

export function populateAccountSelect(selectEl, accounts) {
  selectEl.querySelectorAll("option:not(:first-child)").forEach(o => o.remove());
  for (const a of accounts) {
    selectEl.append(el("option", { value: a.id, textContent: `${a.name} — ${a.plan}` }));
  }
}

function populateViewSelect(selectEl, filterState) {
  selectEl.querySelectorAll("option:not(:first-child)").forEach(o => o.remove());
  const views = filterState.get("savedViews");
  for (const name of Object.keys(views)) {
    selectEl.append(el("option", { value: name, textContent: name }));
  }
}

export function updateSortSelects(sortField, sortDir, section) {
  sortField.querySelectorAll("option").forEach(o => o.remove());
  const fields = SORT_FIELDS[section] || [];
  for (const f of fields) {
    sortField.append(el("option", { value: f.value, textContent: f.label }));
  }
  sortField.value = DEFAULT_SORT[section]?.field || fields[0]?.value || "";
  sortDir.value = "desc";
}

export function updateFilterToggles(filterState, section) {
  const wrap = document.getElementById("filter-toggles");
  if (!wrap) return;
  wrap.innerHTML = "";
  const specs = TOGGLE_SPECS[section];
  if (!specs) return;
  for (const spec of specs) {
    const group = ce("span", "toggle-group");
    group.append(label(spec.label + " "));
    for (const opt of spec.options) {
      const cb = el("input", { type: "checkbox", value: opt, checked: spec.isChecked(filterState, opt) });
      cb.addEventListener("change", () => { spec.onToggle(filterState, section); rerenderSections(); });
      group.append(cb, el("span", { textContent: opt, style: "font-size:11px;margin-right:6px" }));
    }
    wrap.append(group);
  }
}

// ---- Specs ----

const SORT_FIELDS = {
  tickets:    [{ value: "created_at", label: "Created" }, { value: "priority", label: "Priority" }, { value: "status", label: "Status" }],
  incidents:  [{ value: "opened_at", label: "Opened" }, { value: "severity", label: "Severity" }, { value: "duration_m", label: "Duration" }],
  deployments:[{ value: "started_at", label: "Started" }, { value: "risk_score", label: "Risk" }, { value: "environment", label: "Env" }],
  experiments:[{ value: "started_at", label: "Started" }, { value: "lift_pct", label: "Lift" }, { value: "confidence", label: "Confidence" }],
  health:     [{ value: "mrr", label: "MRR" }, { value: "usage_pct", label: "Usage" }, { value: "name", label: "Name" }],
};

const TOGGLE_SPECS = {
  tickets: [{
    label: "Status",
    options: ["open","in_progress","pending_customer","resolved"],
    isChecked: (fs, opt) => fs.get("ticketStatuses").includes(opt),
    onToggle: (fs) => { const cbs = document.querySelectorAll("#filter-toggles input"); const st = []; cbs.forEach((cb, i) => { if (cb.checked && i < 4) st.push(TOGGLE_SPECS.tickets[0].options[i]); }); fs.set("ticketStatuses", st.length ? st : ["open"]); },
  },{
    label: "Priority",
    options: ["low","normal","high","critical"],
    isChecked: (fs, opt) => fs.get("ticketPriorities").includes(opt),
    onToggle: (fs) => { const cbs = document.querySelectorAll("#filter-toggles input"); const st = []; cbs.forEach((cb, i) => { if (cb.checked && i >= 4 && i < 8) st.push(["low","normal","high","critical"][i-4]); }); fs.set("ticketPriorities", st.length ? st : ["normal","high","critical"]); },
  }],
  incidents: [{
    label: "Severity",
    options: ["sev0","sev1","sev2","sev3"],
    isChecked: (fs, opt) => fs.get("incidentSeverities").includes(opt),
    onToggle: (fs) => { const cbs = document.querySelectorAll("#filter-toggles input"); const st = []; cbs.forEach((cb, i) => { if (cb.checked) st.push(["sev0","sev1","sev2","sev3"][i]); }); fs.set("incidentSeverities", st.length ? st : ["sev0","sev1","sev2"]); },
  },{
    label: "Status",
    options: ["investigating","mitigating","resolved","closed"],
    isChecked: (fs, opt) => fs.get("incidentStatuses").includes(opt),
    onToggle: (fs) => { const cbs = document.querySelectorAll("#filter-toggles input"); const st = []; cbs.forEach((cb, i) => { if (cb.checked && i >= 4) st.push(["investigating","mitigating","resolved","closed"][i-4]); }); fs.set("incidentStatuses", st.length ? st : ["investigating","mitigating"]); },
  }],
  deployments: [{
    label: "Env",
    options: ["staging","canary","production"],
    isChecked: (fs, opt) => fs.get("deployEnvironments").includes(opt),
    onToggle: (fs) => { const cbs = document.querySelectorAll("#filter-toggles input"); const st = []; cbs.forEach((cb, i) => { if (cb.checked) st.push(["staging","canary","production"][i]); }); fs.set("deployEnvironments", st.length ? st : ["production"]); },
  },{
    label: "Status",
    options: ["pending","in_progress","completed","rolled_back"],
    isChecked: (fs, opt) => fs.get("deployStatuses").includes(opt),
    onToggle: (fs) => { const cbs = document.querySelectorAll("#filter-toggles input"); const st = []; cbs.forEach((cb, i) => { if (cb.checked && i >= 3) st.push(["pending","in_progress","completed","rolled_back"][i-3]); }); fs.set("deployStatuses", st.length ? st : ["in_progress","completed"]); },
  }],
  experiments: [{
    label: "Status",
    options: ["running","concluded","draft"],
    isChecked: (fs, opt) => fs.get("experimentStatuses").includes(opt),
    onToggle: (fs) => { const cbs = document.querySelectorAll("#filter-toggles input"); const st = []; cbs.forEach((cb, i) => { if (cb.checked) st.push(["running","concluded","draft"][i]); }); fs.set("experimentStatuses", st.length ? st : ["running"]); },
  }],
};

// ---- DOM helpers ----

function ce(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function el(tag, attrs) { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === "textContent") e.textContent = v; else if (k === "className") e.className = v; else e.setAttribute(k, v); } return e; }
function label(t) { const l = document.createElement("span"); l.className = "filter-label"; l.textContent = t; return l; }

function tsToDate(ts) { return new Date(ts).toISOString().slice(0, 10); }
function dateToTs(d) { if (!d) return null; return new Date(d + "T00:00:00Z").getTime(); }

// Global callback — set by app.js
let _rerenderFn = null;
export function setRerenderCallback(fn) { _rerenderFn = fn; }
function rerenderSections() { if (_rerenderFn) _rerenderFn(); }

function currentSection() {
  const active = document.querySelector(".content.active");
  return active ? active.id.replace("section-", "") : "summary";
}
