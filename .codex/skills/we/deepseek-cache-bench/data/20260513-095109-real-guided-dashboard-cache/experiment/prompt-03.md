Continue in the same Northstar Ops Console workspace.

I reviewed turn 2. The new state, scoring modules, account detail panel, and
Node tests are real additions. The next product slice should deepen customer
success operations instead of adding generic bulk.

Implement a Customer Portfolio and Renewal Workbench slice:
1. Add a new main navigation section "Portfolio" and a second section
   "Renewals". They must be reachable from the sidebar and render in the app.
2. Portfolio should provide segmented account lists, sortable columns,
   health/engagement/renewal score badges, CSM owner grouping, risk reasons,
   next best action, and click-to-select account behavior that opens account
   detail.
3. Renewals should show a 120-day renewal calendar, forecast totals,
   expected ARR, at-risk ARR, renewal probability bands, owner workloads,
   upcoming QBRs, and a queue of accounts requiring intervention.
4. Add domain modules under scripts/portfolio/ or scripts/renewals/ for:
   segmentation, owner workload, renewal calendar generation, next-action
   recommendation, expansion opportunity scoring, and playbook matching.
5. Add richer fixtures for success plays, renewal tasks, meetings, owner
   capacity, account notes, stakeholders, expansion signals, and contract
   terms. Keep them coherent with existing accounts/contracts.
6. Add tests for segmentation, renewal calendar, next action, expansion score,
   playbook matching, and owner capacity. Keep tests deterministic.
7. Update validation so it recognizes the new sections and keeps line counting
   accurate.
8. Keep all package scripts passing. If Node warns about module type, fix it
   correctly by setting package metadata, not by suppressing tests.

This is one slice. Do not attempt unrelated modules in this turn. Run
validation and tests at the end, then report current line count and remaining
product gaps.
