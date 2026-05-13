Continue in the same Northstar Ops Console workspace.

I reviewed the Forecasts slice. Forecasting modules and `npm run test-forecast`
pass, but two quality issues need repair before adding more product surface:
1. The prompt requested a `test-forecasting` script, but package.json only has
   `test-forecast`.
2. src/app.js was compressed into very long dense lines. It is syntactically
   valid, but it is less maintainable and violates the product quality bar.

Do only this quality slice:
1. Restore src/app.js to readable modular formatting similar to the earlier
   version: imports grouped at the top, data/bootstrap block, metadata blocks,
   filter-aware render wrappers, navigation, subscriptions, badges, clock, and
   init. Keep all current sections wired: billing, forecasts, account,
   portfolio, renewals, command.
2. Add package script `test-forecasting` as an alias to the same forecast test
   runner, while keeping `test-forecast` working.
3. Strengthen module structure tests to fail if src/app.js has excessive
   long lines or if main metadata objects are compressed into one unreadable
   line. Use a pragmatic threshold, not a style war.
4. Run and pass: node --check src/app.js, npm run validate, npm test,
   npm run test-cs, npm run test-html, npm run test-command,
   npm run test-module, npm run test-billing, npm run test-forecast,
   npm run test-forecasting.
5. Do not add new product features in this turn.

At the end, report the current first-party line count and what readability
invariants are now enforced.
