You are working inside a disposable Docker benchmark workspace at the current
working directory. Build a real, runnable SaaS operations dashboard product,
not a line-count filler artifact.

Product: "Northstar Ops Console" for a mid-market B2B subscription business.
It should help operators inspect revenue, retention, acquisition funnels,
customer health, incident load, support queues, experiments, and deployment
risk.

Implementation constraints:
- Create a dependency-free static app using first-party HTML, CSS, and
  JavaScript modules. Do not fetch packages from the network.
- Use readable source files under src/, plus data/, styles/, scripts/, tests/
  and docs/ as appropriate.
- Do not use a local prebuilt generator or copy an existing generated
  dashboard. If you write utility scripts, they must be authored in this
  workspace during this turn and used only for honest repetitive scaffolding.
- Do not pad lines with meaningless arrays, repeated comments, blank lines,
  or duplicated boilerplate. Prefer real domain modules, validation helpers,
  fixtures, selectors, reducers, formatting, and tests.
- Keep files reasonably modular so the app can grow in later turns.

This first turn should deliver the foundation, not the final 20,000 lines:
1. Working index.html and app shell.
2. Navigation and layout for at least eight dashboard areas.
3. A coherent data model with realistic seeded sample data.
4. Rendering modules for summary KPIs, revenue, funnel, retention, customer
   health, support, incidents, experiments, and deployments.
5. Local validation scripts that check the app entry points and report
   first-party line counts excluding dist/build/dependencies.
6. A simple local preview command in package.json using Python or Node only.

Run the validation script at the end. Report what exists, how to run it, and
what should be expanded next.
