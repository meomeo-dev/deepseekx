Continue in the same Northstar Ops Console workspace.

I reviewed turn 5. The Command Center domain modules and tests pass, but the
real browser entry point is broken: src/app.js has Command Center imports,
fixture merging, renderer entries, and badge code appended after the init IIFE.
`node --check src/app.js` fails with duplicate `const fixtures` and imports after
runtime code. The existing tests missed this, so the app is not actually
runnable in a browser.

Do only this integration and validation repair slice:
1. Fix src/app.js so every import is at the top, fixtures are merged exactly
   once, store.attachFixtures receives the merged base + CS + Command fixtures,
   and Command Center is integrated in TITLES, RENDERERS, SORT_FIELDS,
   rerender callback, and badge updates in the correct places.
2. Ensure the export/import names match. If render-command.js exports
   renderCommandCenter, import and call that exact name, or rename consistently.
3. Remove any dangling appended fragments at the bottom of src/app.js.
4. Strengthen scripts/validate.cjs so validation runs syntax checks on all
   first-party JavaScript, MJS, and CJS files using node --check where valid.
   It must explicitly catch src/app.js syntax errors.
5. Add or update tests so `npm run test-html` or a new command verifies the
   app entry module has imports only before executable statements and has no
   duplicate top-level declarations for fixtures.
6. Run these commands and fix failures: node --check src/app.js,
   npm run validate, npm test, npm run test-cs, npm run test-html,
   npm run test-command.
7. Do not add new product features in this turn. This is a quality gate repair.

At the end, report exactly which entrypoint invariants are now enforced and the
current first-party line count.
