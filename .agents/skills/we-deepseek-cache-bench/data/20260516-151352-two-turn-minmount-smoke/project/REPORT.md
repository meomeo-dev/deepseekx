# Revenue Command Center — 2-Round Smoke Benchmark Report

## Objective

Build a functional, user-ready product prototype within 2 rounds of iterative development.
Round 1 delivered the project skeleton, data model, dashboard view, and validation.
Round 2 added an actions queue, risk playbook, offline capability, tabbed navigation,
export, and interactive state management.

This is a **smoke benchmark** — not a full 10,000-line production benchmark.
The goal is a compact but real product slice that a user can open and experience.

## How to Start

```bash
npm start
```

Opens the site at **http://localhost:5173** on any browser. No dependencies beyond Node.js >= 18.
The page works fully offline — no external CDN, font, or API calls.

## How to Run Validation

```bash
npm test
```

Runs `scripts/validate.mjs` which checks file inventory, data structure, business rules,
CSS coverage, security constraints, offline compliance, and new Round 2 features.

## Implemented Features

### Dashboard Tab
- 6 top-level business metrics (Total ARR, At-Risk ARR, Overdue Invoices, Open Tickets, Active Incidents, Accounts at Risk)
- 12 accounts with health scores, tiers, domains, and CSM assignments
- 5 coherent risk domains: Renewals, Billing, Support, Usage, Incidents
- Account risk list with search, risk-level filter, domain filter, and quick-filter chips
- Expandable detail panels per account showing domain-specific records
- Empty state, error state, and loading state

### Actions Tab (New in Round 2)
- Concrete task queue derived from live data across all 5 domains
- Columns: Domain, Action description, Account, Owner, Due date, Impact, Status
- Per-action buttons: Complete (check) and Defer (pause), with Undo for non-pending
- Status updates change page state immediately (completed/deferred/pending)
- Filters: Owner, Status, Domain
- Pending count badge on tab
- Export as plain text (toggleable)

### Playbook Tab (New in Round 2)
- Per-account risk playbooks for all high-risk and critical accounts
- Account-level filter dropdown
- Each playbook shows: risk summary pills, recommended action steps, open actions, total financial impact
- Derived from the same live data model

### Offline Compliance (New in Round 2)
- No Google Fonts or external CDN resources
- System-native font stack: -apple-system, Segoe UI, SF Mono, Fira Code, etc.

## Validation Coverage

87 assertions in Round 1 → extended to **100+** in Round 2, covering:
- File inventory (including REPORT.md)
- package.json scripts
- Server configuration (0.0.0.0:5173, charset)
- HTML structure, a11y, tab panels, all state containers
- Data structure: 6 tables, actions, playbooks, all field types
- Business rules: minimum counts, risk distribution, health score spread
- CSS: custom properties, tabs, actions table, playbooks, export, responsive
- Security: no API keys, no credential leaks, no external network requests
- Offline: no Google Fonts, no CDN URLs in any source file

## What Was Not Done (Full Benchmark Scope)

- No backend API or database integration
- No authentication or multi-user support
- No real-time websocket updates
- No comprehensive test suite (Jest/Vitest) — validation is static analysis only
- No CI/CD or deployment configuration
- No internationalization
- No accessibility audit beyond basic structure
- No production build or minification

These are appropriate for a full 10,000-line benchmark but out of scope for a 2-round smoke test.

## Round 3 Suggestions

- Replace static data with a small Express API + JSON file store
- Add a "health trend" sparkline chart per account (canvas or SVG)
- Add keyboard shortcuts (j/k navigation, / for search)
- Persist action state and filters to localStorage
- Add an "alerts" notification bell with count badge
- Add a "drill-down" view: click a metric card to see contributing accounts
- Add more accounts and data variety to stress-test filtering and rendering

## File Inventory

| File | Lines (approx) | Role |
|---|---|---|
| package.json | 13 | npm scripts |
| server.mjs | 40 | Static file server (0.0.0.0:5173) |
| public/index.html | ~90 | HTML shell with tabbed interface |
| public/css/styles.css | ~470 | Full dark dashboard theme |
| public/js/data.js | ~330 | Structured data: accounts, renewals, invoices, tickets, usage, incidents, actions, playbooks |
| public/js/utils.js | 71 | Formatting, filtering, scoring |
| public/js/components.js | ~300 | UI rendering: metrics, accounts, detail panels, actions table, playbooks, export |
| public/js/app.js | ~270 | App controller: tabs, filters, action mutations, export, init |
| scripts/validate.mjs | ~280 | 100+ assertion validation suite |
| REPORT.md | ~80 | This report |
