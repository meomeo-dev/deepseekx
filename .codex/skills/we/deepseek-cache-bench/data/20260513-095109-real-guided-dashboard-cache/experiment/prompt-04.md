Continue in the same Northstar Ops Console workspace.

I reviewed turn 3. The Portfolio/Renewals modules and tests are useful, but
there is a structural bug: index.html has Portfolio/Renewals nav links and
sections appended after the closing </html> tag. The current validation only
checks substrings, so it missed this.

Do only this quality slice now:
1. Fix index.html so all sidebar links live inside <nav class="sidebar-nav">,
   all sections live inside <main class="main">, and there is no content after
   </html> except optional trailing whitespace.
2. Ensure Account Detail, Portfolio, and Renewals sections are in the intended
   DOM location and are reachable by sidebar/app navigation.
3. Strengthen scripts/validate.cjs so it catches malformed section placement,
   content after </html>, missing nav entries, duplicate section IDs, and
   sections outside <main>.
4. Add a Node validation test or extend existing tests to assert those HTML
   structure invariants. Do not use external packages.
5. Keep package scripts passing: npm run validate, npm test, npm run test-cs.
6. Do not add new product modules in this turn. Keep this as a DOM and
   validation hardening pass.

At the end, run the three package commands and report the current first-party
line count plus the exact DOM invariants now enforced.
