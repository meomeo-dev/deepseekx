#!/usr/bin/env node
// Northstar Ops Console — Strengthened validation script.
// Checks entry points, line counts, JS syntax, HTML structure invariants.

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");

const REQUIRED_FILES = [
  "index.html", "package.json", "styles/main.css",
  "data/seed.js", "data/store.js", "data/filters.js", "data/fixtures.js", "data/fixtures-cs.js",
  "scripts/format.js",
  "scripts/render-summary.js", "scripts/render-revenue.js", "scripts/render-funnel.js",
  "scripts/render-retention.js", "scripts/render-health.js", "scripts/render-support.js",
  "scripts/render-incidents.js", "scripts/render-experiments.js", "scripts/render-deployments.js",
  "scripts/render-account-detail.js", "scripts/render-portfolio.js", "scripts/render-renewals.js",
  "scripts/ui-controls.js",
  "scripts/portfolio/segmentation.js", "scripts/portfolio/next-action.js", "scripts/portfolio/expansion-scoring.js",
  "scripts/renewals/calendar.js", "scripts/renewals/owner-workload.js", "scripts/renewals/playbook-matching.js",
  "scripts/render-command.js", "data/fixtures-command.js",
  "scripts/render-billing.js", "data/fixtures-billing.js",
  "scripts/render-forecasts.js", "data/fixtures-forecast.js",
  "scripts/render-usage.js", "data/fixtures-usage.js",
  "scripts/command-center/escalation-routing.js", "scripts/command-center/sla-priority-queue.js",
  "scripts/command-center/timeline-normalization.js", "scripts/command-center/blast-radius.js",
  "scripts/command-center/communication-drafts.js", "scripts/command-center/runbook-recommendation.js",
  "scripts/command-center/postmortem-actions.js",
  "scripts/billing/invoice-aging.js", "scripts/billing/dunning-prioritization.js", "scripts/billing/failed-payment-routing.js", "scripts/billing/revenue-leakage.js", "scripts/billing/credit-memo-rules.js", "scripts/billing/tax-risk-scoring.js", "scripts/billing/incident-billing-correlation.js", "scripts/billing/cash-collection-forecast.js",
  "scripts/forecasting/time-series.js", "scripts/forecasting/arr-projection.js", "scripts/forecasting/churn-forecast.js", "scripts/forecasting/expansion-pipeline.js", "scripts/forecasting/support-staffing.js", "scripts/forecasting/incident-risk-forecast.js", "scripts/forecasting/deploy-stability-trend.js", "scripts/forecasting/scenario-modeling.js", "scripts/forecasting/executive-narrative.js",
  "scripts/usage/feature-adoption-scoring.js", "scripts/usage/seat-utilization.js", "scripts/usage/usage-cohorting.js", "scripts/usage/onboarding-tracking.js", "scripts/usage/pqa-detection.js", "scripts/usage/adoption-blockers.js", "scripts/usage/anomaly-triage.js", "scripts/usage/adoption-playbooks.js",
  "scripts/scoring/account-scoring.js", "scripts/scoring/renewal-forecast.js", "scripts/scoring/sla-detection.js",
  "scripts/scoring/incident-impact.js", "scripts/scoring/deploy-risk.js", "scripts/scoring/experiment-decision.js",
  "src/app.js",
];

const FIRST_PARTY_EXTS = new Set([".html", ".css", ".js", ".mjs", ".json"]);
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "tests", "docs"]);

const SECTION_NAMES = [
  "summary", "revenue", "funnel", "retention",
  "health", "support", "incidents", "experiments", "deployments",
  "billing", "forecasts", "usage", "account", "portfolio", "renewals", "command",
];

let errors = 0;
function fail(msg) { console.error("  FAIL:", msg); errors++; }
function ok(msg) { console.log("  OK:", msg); }

// ---- Entry point check ----
console.log("=== Entry Point Check ===");
for (const f of REQUIRED_FILES) {
  const full = path.join(ROOT, f);
  if (!fs.existsSync(full)) { fail("MISSING: " + f); }
  else ok(f);
}

// ---- JS Syntax check (node --check) ----
console.log("\n=== JavaScript Syntax Check (node --check) ===");
let syntaxErrors = 0;
const syntaxChecked = [];
for (const f of REQUIRED_FILES) {
  const ext = path.extname(f).toLowerCase();
  if (ext !== ".js" && ext !== ".mjs" && ext !== ".cjs") continue;
  const full = path.join(ROOT, f);
  try {
    execSync(`node --check "${full}"`, { stdio: "pipe", timeout: 5000 });
    syntaxChecked.push(f);
  } catch (e) {
    const stderr = e.stderr ? e.stderr.toString().split("\n").slice(0, 3).join(" | ") : "unknown error";
    fail(`Syntax error in ${f}: ${stderr.slice(0, 150)}`);
    syntaxErrors++;
  }
}
if (syntaxErrors === 0 && syntaxChecked.length > 0) {
  ok(`All ${syntaxChecked.length} JS/MJS/CJS files pass node --check`);
}

// ---- Line counts ----
function countLines(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    let nonEmpty = 0;
    for (const line of lines) { if (line.trim().length > 0) nonEmpty++; }
    return { total: lines.length, nonEmpty };
  } catch { return { total: 0, nonEmpty: 0 }; }
}

function walk(dir, relPath) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const name = entry.name;
    if (name.startsWith(".") && name !== ".gitignore") continue;
    const full = path.join(dir, name);
    const rel = relPath ? `${relPath}/${name}` : name;
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(name)) continue;
      walk(full, rel);
    } else {
      const ext = path.extname(name).toLowerCase();
      if (!FIRST_PARTY_EXTS.has(ext)) continue;
      const { total, nonEmpty } = countLines(full);
      fileLines.push({ file: rel, total, nonEmpty });
    }
  }
}

let fileLines = [];
walk(ROOT, "");

let totalLines = fileLines.reduce((s, f) => s + f.total, 0);
const nonEmptyTotal = fileLines.reduce((s, f) => s + f.nonEmpty, 0);

console.log("\n=== Line Count Report ===");
console.log(`  Files:        ${fileLines.length}`);
console.log(`  Total lines:  ${totalLines}`);
console.log(`  Non-empty:    ${nonEmptyTotal}`);

console.log("\n=== Per-File Lines ===");
const maxName = Math.max(...fileLines.map(f => f.file.length));
for (const f of fileLines) {
  const pad = " ".repeat(Math.max(2, maxName - f.file.length + 2));
  console.log(`  ${f.file}${pad}${String(f.total).padStart(4)} total  / ${String(f.nonEmpty).padStart(4)} non-empty`);
}

// ---- HTML Structure Invariants ----
console.log("\n=== HTML Structure Invariants ===");

const htmlPath = path.join(ROOT, "index.html");
const html = fs.readFileSync(htmlPath, "utf-8");

// 1. No content after </html>
const htmlCloseIdx = html.indexOf("</html>");
if (htmlCloseIdx === -1) {
  fail("Missing </html> closing tag");
} else {
  const afterHtml = html.slice(htmlCloseIdx + 7);
  if (afterHtml.trim().length > 0) {
    const tail = afterHtml.trim().split("\n").slice(0, 3).join(" | ");
    fail("Content found after </html>: " + tail.slice(0, 120));
  } else {
    ok("No content after </html>");
  }
}

// 2. All sections inside <main>
const mainOpen = html.indexOf('<main class="main">');
const mainClose = html.indexOf('</main>');
if (mainOpen === -1) fail("Missing <main class=\"main\">");
if (mainClose === -1) fail("Missing </main>");
if (mainOpen !== -1 && mainClose !== -1) {
  const allSectionMatches = [...html.matchAll(/<section\s+class="content[^"]*"\s+id="section-(\w+)"/g)];
  let sectionsOutsideMain = 0;
  let sectionInMainCount = 0;
  for (const m of allSectionMatches) {
    if (m.index >= mainOpen && m.index < mainClose) {
      sectionInMainCount++;
    } else {
      sectionsOutsideMain++;
      fail(`Section "${m[1]}" is outside <main>`);
    }
  }
  if (sectionsOutsideMain === 0) ok(`All ${sectionInMainCount} sections inside <main>`);
}

// 3. All nav links inside <nav>
const navOpen = html.indexOf('<nav class="sidebar-nav">');
const navClose = html.indexOf('</nav>');
if (navOpen === -1) fail('Missing <nav class="sidebar-nav">');
if (navClose === -1) fail('Missing </nav>');
if (navOpen !== -1 && navClose !== -1) {
  const allNavMatches = [...html.matchAll(/<a\s[^>]*data-section="(\w+)"/g)];
  let navLinksOutside = 0;
  let navLinksInside = 0;
  for (const m of allNavMatches) {
    if (m.index >= navOpen && m.index < navClose) {
      navLinksInside++;
    } else {
      navLinksOutside++;
      fail(`Nav link "${m[1]}" is outside <nav class="sidebar-nav">`);
    }
  }
  if (navLinksOutside === 0) ok(`All ${navLinksInside} nav links inside <nav>`);
}

// 4. Section-to-nav mapping
const sectionIdsInHtml = new Set();
for (const m of html.matchAll(/id="section-(\w+)"/g)) {
  sectionIdsInHtml.add(m[1]);
}
const navSections = new Set();
for (const m of html.matchAll(/data-section="(\w+)"/g)) {
  navSections.add(m[1]);
}

for (const name of SECTION_NAMES) {
  if (!sectionIdsInHtml.has(name)) fail(`Section "section-${name}" missing from DOM`);
  if (name !== "account" && !navSections.has(name)) fail(`Nav link for "${name}" missing`);
}
for (const name of navSections) {
  if (!sectionIdsInHtml.has(name)) fail(`Nav link "${name}" has no matching section`);
}

// 5. No duplicate section IDs
const sectionIdCounts = {};
for (const m of html.matchAll(/id="section-(\w+)"/g)) {
  sectionIdCounts[m[1]] = (sectionIdCounts[m[1]] || 0) + 1;
}
let dupes = 0;
for (const [id, count] of Object.entries(sectionIdCounts)) {
  if (count > 1) { fail(`Duplicate section ID "section-${id}" appears ${count} times`); dupes++; }
}
if (dupes === 0) ok("No duplicate section IDs");

// 6. Script tag placement
const bodyClose = html.indexOf("</body>");
const scriptTag = html.indexOf('<script type="module"');
if (scriptTag === -1) fail('Missing <script type="module"> entry');
else {
  if (scriptTag > mainClose && scriptTag < bodyClose) {
    ok("Script tag properly placed between </main> and </body>");
  } else {
    fail("Script tag not between </main> and </body>");
  }
}

// 7. Section balance
const allSectionTags = (html.match(/<section\s/g) || []).length;
const allSectionCloses = (html.match(/<\/section>/g) || []).length;
if (allSectionTags === allSectionCloses) {
  ok(`Section tag balance: ${allSectionTags} open, ${allSectionCloses} close`);
} else {
  fail(`Section tag imbalance: ${allSectionTags} open, ${allSectionCloses} close`);
}

// 8. Sections summary
console.log("\n=== Dashboard Sections ===");
let sectionCount = 0;
for (const s of SECTION_NAMES) {
  const found = html.includes(`id="section-${s}"`);
  console.log(`  ${found ? "✓" : "✗"} ${s}`);
  if (found) sectionCount++;
}
console.log(`  Sections: ${sectionCount}/${SECTION_NAMES.length}`);

// ---- Result ----
console.log(`\n=== Result: ${errors === 0 ? "PASS" : "FAIL"} ===`);
if (errors > 0) {
  console.log(`  ${errors} validation error(s).`);
  process.exit(1);
}
console.log("  All checks passed. Ready to preview with: npm run preview");
process.exit(0);
