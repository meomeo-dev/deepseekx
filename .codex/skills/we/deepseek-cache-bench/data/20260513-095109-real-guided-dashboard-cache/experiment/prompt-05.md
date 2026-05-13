Continue in the same Northstar Ops Console workspace.

I reviewed the DOM hardening pass. The structure and HTML tests now pass. The
next product slice is Support and Incident Command Center. This must be a real
operator workflow, not generic filler.

Implement one coherent slice:
1. Add a main navigation section "Command Center" inside the existing DOM
   structure and app router.
2. The Command Center should combine active incidents, support escalations,
   SLA breaches, customer impact, on-call ownership, runbook actions,
   incident timelines, communication drafts, and follow-up tasks.
3. Add domain modules under scripts/command-center/ for:
   escalation routing, SLA priority queue, incident timeline normalization,
   blast-radius estimation, customer communication draft generation, runbook
   recommendation, and postmortem action extraction.
4. Add fixtures for on-call schedule, escalation policies, runbooks, service
   ownership, status page updates, customer communications, postmortem tasks,
   and incident-to-account impact mapping. Keep them coherent with existing
   incidents, tickets, accounts, and deployments.
5. Render the Command Center with triage cards, an active incident table,
   SLA breach queue, impacted customer list, owner workload, recommended
   runbooks, and communication drafts. Rows should be meaningful and linked to
   account detail when account IDs are present.
6. Add deterministic Node tests for every new command-center domain module.
7. Update validation and HTML tests for the new section and nav link.
8. Keep npm run validate, npm test, npm run test-cs, and npm run test-html
   passing. Add a test-command script if helpful and run it too.

Do not add unrelated product areas in this turn. At the end, report current
first-party line count and the new operational workflows.
