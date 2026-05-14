Continue in the same Northstar Ops Console workspace.

The Billing Ops slice is integrated and tested. The next product slice is an
Executive Analytics and Forecasting Workbench. Keep it coherent with existing
accounts, revenue, billing, renewals, support, incidents, deployments, and
experiments. This should help leaders understand operating trends and future
risk.

Implement one slice:
1. Add a main navigation section "Forecasts" with correct DOM placement,
   router integration, section title, validation, and HTML/module tests.
2. Render forecast views for ARR trajectory, churn forecast, expansion
   forecast, support load forecast, incident risk forecast, deployment risk
   trend, cash collection outlook, and experiment portfolio contribution.
3. Add domain modules under scripts/forecasting/ for:
   time-series bucketing, ARR projection, churn cohort forecast, expansion
   pipeline forecast, support staffing forecast, incident risk forecast,
   deployment stability trend, scenario modeling, and executive narrative
   generation.
4. Add fixtures for forecast assumptions, seasonality, hiring capacity,
   scenario overrides, quarterly targets, budget constraints, roadmap bets,
   and executive notes. Reuse existing IDs where possible.
5. Add deterministic Node tests for every new forecasting domain module.
6. Update validation, HTML tests, and module structure tests as needed.
7. Run and pass: node --check src/app.js, npm run validate, npm test,
   npm run test-cs, npm run test-html, npm run test-command,
   npm run test-module, npm run test-billing, and the new forecast test script.

Do not pad lines. Keep each module readable and each function meaningful. At
the end, report current first-party line count and forecasting workflows added.
