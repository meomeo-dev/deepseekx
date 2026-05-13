Continue in the same Northstar Ops Console workspace.

The app entry integration is now valid and syntax-checked. The next product
slice is a Revenue and Billing Operations Workbench. Keep it coherent with the
existing revenue, contracts, accounts, invoices, support tickets, and Command
Center data. Do not add unrelated areas.

Implement one slice:
1. Add a main navigation section "Billing Ops" with correct DOM placement,
   router integration, section title, and validation/test updates.
2. Render billing operations views for invoice aging, failed payments,
   dunning queue, credit memos, payment gateway status, tax/compliance flags,
   expansion billing impacts, and revenue leakage risks.
3. Add domain modules under scripts/billing/ for:
   invoice-aging buckets, dunning prioritization, failed-payment routing,
   revenue-leakage detection, credit-memo approval rules, tax-risk scoring,
   billing-incident correlation, and cash-collection forecast.
4. Add fixtures for payment methods, payment attempts, credit memos, tax
   profiles, billing contacts, collection notes, gateway events, entitlement
   mismatches, and billing incident links. Reuse account IDs and invoices.
5. Add deterministic Node tests for every new billing domain module.
6. Update validation, HTML tests, and module structure tests where needed.
7. Run and pass: node --check src/app.js, npm run validate, npm test,
   npm run test-cs, npm run test-html, npm run test-command,
   npm run test-module, and the new billing test script.

Do not pad lines. Keep functions readable and modules bounded. At the end,
report current first-party line count and the billing workflows added.
