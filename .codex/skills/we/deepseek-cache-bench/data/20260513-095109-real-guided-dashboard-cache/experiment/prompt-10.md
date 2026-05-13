Continue in the same Northstar Ops Console workspace.

The app entry and Forecasts quality repair pass. Current first-party source is
about 9,170 lines, so we still need substantial real product work to reach the
20,000-line benchmark target. The next slice is Product Usage and Feature
Adoption Operations. Keep it coherent with existing accounts, feature adoption,
usage events, success plans, support tickets, revenue, forecasts, and
expansion signals.

Implement one slice:
1. Add a main navigation section "Usage Ops" with correct DOM placement,
   router integration, title metadata, validation, HTML tests, and module tests.
2. Render views for feature adoption funnels, account usage cohorts, inactive
   seat detection, adoption blockers, onboarding milestones, power-user
   segments, feature-level expansion opportunities, and usage anomaly triage.
3. Add domain modules under scripts/usage/ for:
   feature adoption scoring, seat utilization analysis, usage cohorting,
   onboarding milestone tracking, product-qualified account detection,
   adoption blocker detection, usage anomaly triage, and adoption playbook
   recommendation.
4. Add fixtures for features, seats, user activity, onboarding events, product
   milestones, usage thresholds, feature dependencies, training sessions,
   enablement tasks, and customer product feedback. Reuse account IDs and
   existing feature adoption data where possible.
5. Add deterministic Node tests for every new usage domain module.
6. Update validation, HTML tests, module structure tests, and package scripts.
7. Preserve readability of src/app.js. Do not compress metadata or long lines.
8. Run and pass: node --check src/app.js, npm run validate, npm test,
   npm run test-cs, npm run test-html, npm run test-command,
   npm run test-module, npm run test-billing, npm run test-forecasting,
   and the new usage test script.

Do not add unrelated product areas. Do not pad lines with repeated data or
comments. At the end, report current first-party line count and the usage
operations workflows added.
