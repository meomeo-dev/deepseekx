// Revenue Command Center — Validation Script
// Run via: npm test  (or: node scripts/validate.mjs)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');

let passed = 0;
let failed = 0;

function check(description, condition) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${description}`);
  } else {
    failed++;
    console.error(`  ✗ ${description}`);
  }
}

function assertFile(relPath) {
  const full = path.join(ROOT, relPath);
  const exists = fs.existsSync(full);
  check(`File exists: ${relPath}`, exists);
  return exists;
}

function assertFileContains(relPath, needle, label) {
  const full = path.join(ROOT, relPath);
  if (!fs.existsSync(full)) {
    check(`File content: ${label} in ${relPath}`, false);
    return;
  }
  const content = fs.readFileSync(full, 'utf-8');
  check(`File content: ${label} in ${relPath}`, content.includes(needle));
}

function assertNoFileContains(relPath, forbidden, label) {
  const full = path.join(ROOT, relPath);
  if (!fs.existsSync(full)) {
    check(`File content: no '${label}' in ${relPath}`, false);
    return;
  }
  const content = fs.readFileSync(full, 'utf-8');
  check(`File content: no '${label}' in ${relPath}`, !content.includes(forbidden));
}

// ---- Phase 1: File inventory ----
console.log('\n=== Phase 1: File Inventory ===');
assertFile('package.json');
assertFile('server.mjs');
assertFile('public/index.html');
assertFile('public/css/styles.css');
assertFile('public/js/data.js');
assertFile('public/js/utils.js');
assertFile('public/js/components.js');
assertFile('public/js/app.js');
assertFile('scripts/validate.mjs');

// ---- Phase 2: package.json validation ----
console.log('\n=== Phase 2: package.json ===');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
check('package.json has "start" script', typeof pkg.scripts.start === 'string');
check('package.json has "test" script', typeof pkg.scripts.test === 'string');
check('package.json start points to server.mjs', pkg.scripts.start.includes('server.mjs'));
check('package.json test points to validate.mjs', pkg.scripts.test.includes('validate.mjs'));

// ---- Phase 3: Server validation ----
console.log('\n=== Phase 3: Server ===');
assertFileContains('server.mjs', '0.0.0.0', 'Binds to 0.0.0.0');
assertFileContains('server.mjs', '5173', 'Port 5173');
assertFileContains('server.mjs', 'createServer', 'Uses http.createServer');
assertFileContains('server.mjs', 'public', 'Serves public/ directory');

// ---- Phase 4: HTML validation ----
console.log('\n=== Phase 4: HTML ===');
assertFileContains('public/index.html', '<title>Revenue Command Center</title>', 'Title tag');
assertFileContains('public/index.html', 'data.js', 'Loads data.js');
assertFileContains('public/index.html', 'utils.js', 'Loads utils.js');
assertFileContains('public/index.html', 'components.js', 'Loads components.js');
assertFileContains('public/index.html', 'app.js', 'Loads app.js');
assertFileContains('public/index.html', 'styles.css', 'Loads styles.css');
assertFileContains('public/index.html', 'metrics-row', 'Has metrics row');
assertFileContains('public/index.html', 'account-list', 'Has account list');
assertFileContains('public/index.html', 'search-input', 'Has search input');
assertFileContains('public/index.html', 'risk-filter', 'Has risk filter');
assertFileContains('public/index.html', 'error-container', 'Has error container');
assertFileContains('public/index.html', 'empty-state', 'Has empty state');
assertFileContains('public/index.html', 'Loading', 'Has loading state');
assertFileContains('public/index.html', 'lang="en"', 'Has lang attribute');
assertFileContains('public/index.html', 'viewport', 'Has viewport meta');

// ---- Phase 5: Data structure validation ----
console.log('\n=== Phase 5: Data Structure ===');
const dataRaw = fs.readFileSync(path.join(PUBLIC, 'js/data.js'), 'utf-8');

// Data tables
check('Data has accounts array', dataRaw.includes('const accounts'));
check('Data has renewals array', dataRaw.includes('const renewals'));
check('Data has invoices array', dataRaw.includes('const invoices'));
check('Data has tickets array', dataRaw.includes('const tickets'));
check('Data has usage array', dataRaw.includes('const usage'));
check('Data has incidents array', dataRaw.includes('const incidents'));
check('Data has riskProfiles', dataRaw.includes('riskProfiles'));
check('Data has getMetrics function', dataRaw.includes('getMetrics'));

// Account fields
check('Accounts have "id" field', dataRaw.includes("id: 'acct-"));
check('Accounts have "name" field', dataRaw.includes("name: '"));
check('Accounts have "arr" field', dataRaw.includes('arr: '));
check('Accounts have "healthScore" field', dataRaw.includes('healthScore: '));
check('Accounts have "csm" field', dataRaw.includes("csm: '"));
check('Accounts have "tier" field', dataRaw.includes("tier: '"));
check('Accounts have "domain" field', dataRaw.includes("domain: '"));

// Renewal fields
check('Renewals have "status" field', dataRaw.includes("status: '") && dataRaw.includes('renewals'));
check('Renewals have "amount" field', dataRaw.includes('amount: ') && dataRaw.includes('rnw-'));
check('Renewals have "riskFlags" field', dataRaw.includes('riskFlags'));

// Invoice fields
check('Invoices have "status" field (Overdue)', dataRaw.includes("status: 'Overdue'"));
check('Invoices have "daysOverdue" field', dataRaw.includes('daysOverdue:'));

// Ticket fields
check('Tickets have "severity" field (P1)', dataRaw.includes("severity: 'P1'"));
check('Tickets have "status" field', dataRaw.includes("status: 'Open'") || dataRaw.includes("status: 'In Progress'"));

// Usage fields
check('Usage has "trend" field (down)', dataRaw.includes("trend: 'down'"));
check('Usage has "activeUsers" field', dataRaw.includes('activeUsers:'));

// Incidents fields
check('Incidents have "severity" field', dataRaw.includes("severity: 'P") && dataRaw.includes('incidents'));
check('Incidents have "status" field', dataRaw.includes("status: 'Open'") || dataRaw.includes("status: 'Investigating'"));

// ---- Phase 6: Business rules (via data analysis) ----
console.log('\n=== Phase 6: Business Rules ===');

// We'll do lightweight static analysis on the data file
// Extract the accounts array and parse counts

// Count accounts
const acctMatches = dataRaw.match(/id:\s*'acct-\d+'/g) || [];
check('At least 10 accounts exist', acctMatches.length >= 10);

// Count renewals
const rnwMatches = dataRaw.match(/id:\s*'rnw-\d+'/g) || [];
check('At least 5 renewals exist', rnwMatches.length >= 5);

// Count invoices
const invMatches = dataRaw.match(/id:\s*'inv-\d+'/g) || [];
check('At least 5 invoices exist', invMatches.length >= 5);

// Count tickets
const tktMatches = dataRaw.match(/id:\s*'tkt-\d+'/g) || [];
check('At least 5 tickets exist', tktMatches.length >= 5);

// Count usage records
const useMatches = dataRaw.match(/id:\s*'use-\d+'/g) || [];
check('At least 5 usage records exist', useMatches.length >= 5);

// Count incidents
const incMatches = dataRaw.match(/id:\s*'inc-\d+'/g) || [];
check('At least 3 incidents exist', incMatches.length >= 3);

// Risk distribution: at least one critical, one high
check('At least one critical risk renewal', dataRaw.includes("status: 'Critical'"));
check('At least one overdue invoice', dataRaw.includes("status: 'Overdue'"));
check('At least one P1 ticket', dataRaw.includes("severity: 'P1'"));
check('At least one usage decline', dataRaw.includes("trend: 'down'"));

// Health score distribution
const hsMatches = dataRaw.match(/healthScore:\s*(\d+)/g) || [];
const hsValues = hsMatches.map(m => parseInt(m.match(/\d+/)[0], 10));
const hsLow = hsValues.filter(v => v < 40).length;
const hsHigh = hsValues.filter(v => v >= 70).length;
check('At least 2 accounts with low health score (<40)', hsLow >= 2);
check('At least 2 accounts with high health score (>=70)', hsHigh >= 2);

// ---- Phase 7: CSS validation ----
console.log('\n=== Phase 7: CSS ===');
assertFileContains('public/css/styles.css', ':root', 'CSS custom properties');
assertFileContains('public/css/styles.css', '--bg-primary', 'Dark background var');
assertFileContains('public/css/styles.css', '--green', 'Green accent var');
assertFileContains('public/css/styles.css', '--amber', 'Amber accent var');
assertFileContains('public/css/styles.css', '--red', 'Red accent var');
assertFileContains('public/css/styles.css', '@media', 'Responsive styles');
assertFileContains('public/css/styles.css', '.empty-state', 'Empty state styles');
assertFileContains('public/css/styles.css', '.error-banner', 'Error banner styles');
assertFileContains('public/css/styles.css', '.risk-badge.critical', 'Critical risk badge');
assertFileContains('public/css/styles.css', '.account-detail', 'Detail panel styles');

// ---- Phase 8: Security / constraints ----
console.log('\n=== Phase 8: Security & Constraints ===');
assertNoFileContains('server.mjs', 'API_KEY', 'API key in server');
assertNoFileContains('server.mjs', 'api_key', 'api_key in server');
assertNoFileContains('server.mjs', '.env', '.env reference in server');
assertNoFileContains('public/js/data.js', 'API_KEY', 'API key in data');
assertNoFileContains('public/js/data.js', 'password:', 'password credential in data');
assertFileContains('server.mjs', 'utf-8', 'Charset specified in server');
assertFileContains('public/index.html', 'UTF-8', 'Charset in HTML');


// ---- Phase 9: Offline Compliance ----
console.log("\n=== Phase 9: Offline Compliance ===");
assertNoFileContains("public/index.html", "googleapis", "Google Fonts in HTML");
assertNoFileContains("public/index.html", "fonts.gstatic", "Google Fonts CDN in HTML");
assertNoFileContains("public/index.html", "https://", "External HTTPS URLs in HTML");
assertNoFileContains("public/css/styles.css", "googleapis", "Google Fonts in CSS");
assertNoFileContains("public/css/styles.css", "fonts.gstatic", "Google Fonts CDN in CSS");
assertNoFileContains("public/css/styles.css", "Inter", "Google Font Inter in CSS");
assertNoFileContains("public/css/styles.css", "JetBrains", "Google Font JetBrains in CSS");
assertFileContains("public/css/styles.css", "-apple-system", "System font stack present");

// ---- Phase 10: Round 2 HTML Features ----
console.log("\n=== Phase 10: Round 2 HTML Features ===");
assertFileContains("public/index.html", "tab-nav", "Tab navigation present");
assertFileContains("public/index.html", "panel-dashboard", "Dashboard panel");
assertFileContains("public/index.html", "panel-actions", "Actions panel");
assertFileContains("public/index.html", "panel-playbook", "Playbook panel");
assertFileContains("public/index.html", "action-list", "Action list container");
assertFileContains("public/index.html", "playbook-list", "Playbook list container");
assertFileContains("public/index.html", "export-actions-btn", "Export button");
assertFileContains("public/index.html", "actions-owner-filter", "Actions owner filter");
assertFileContains("public/index.html", "actions-status-filter", "Actions status filter");
assertFileContains("public/index.html", "playbook-account-filter", "Playbook account filter");
assertFileContains("public/index.html", "Round 2", "Round 2 badge");
assertFileContains("public/index.html", "utils.js", "Utils loads before data");
// Verify script order: utils.js before data.js
const htmlContent = fs.readFileSync(path.join(PUBLIC, "index.html"), "utf-8");
const utilsIdx = htmlContent.indexOf("utils.js");
const dataIdx = htmlContent.indexOf("data.js");
check("utils.js loads before data.js", utilsIdx > 0 && dataIdx > 0 && utilsIdx < dataIdx);

// ---- Phase 11: Round 2 Data Features ----
console.log("\n=== Phase 11: Round 2 Data Features ===");
assertFileContains("public/js/data.js", "playbooks", "Playbooks data array");
assertFileContains("public/js/data.js", "buildActions", "buildActions function");
assertFileContains("public/js/data.js", "getActions", "getActions function");
assertFileContains("public/js/data.js", "updateActionStatus", "updateActionStatus function");
assertFileContains("public/js/data.js", "getPlaybooksForAccount", "getPlaybooksForAccount function");
assertFileContains("public/js/data.js", "Save Play", "Executive Save playbook");
assertFileContains("public/js/data.js", "Payment Recovery", "Payment Recovery playbook");
assertFileContains("public/js/data.js", "Adoption Rescue", "Adoption Rescue playbook");

// ---- Phase 12: Round 2 CSS Features ----
console.log("\n=== Phase 12: Round 2 CSS Features ===");
assertFileContains("public/css/styles.css", ".tab-nav", "Tab nav styles");
assertFileContains("public/css/styles.css", ".tab-panel", "Tab panel styles");
assertFileContains("public/css/styles.css", ".action-table", "Action table styles");
assertFileContains("public/css/styles.css", ".action-status", "Action status styles");
assertFileContains("public/css/styles.css", ".btn-sm", "Small button styles");
assertFileContains("public/css/styles.css", ".playbook-card", "Playbook card styles");
assertFileContains("public/css/styles.css", ".playbook-step-list", "Playbook step list styles");
assertFileContains("public/css/styles.css", ".playbook-impact", "Playbook impact styles");
assertFileContains("public/css/styles.css", "#actions-export-area", "Export area styles");
assertFileContains("public/css/styles.css", ".domain-dot", "Domain dot styles");

// ---- Phase 13: Project Report ----
console.log("\n=== Phase 13: Project Report ===");
assertFile("REPORT.md");
assertFileContains("REPORT.md", "npm start", "Startup instructions");
assertFileContains("REPORT.md", "npm test", "Test instructions");
assertFileContains("REPORT.md", "2-round", "2-round mention");
assertFileContains("REPORT.md", "Dashboard", "Dashboard mentioned");
assertFileContains("REPORT.md", "Actions", "Actions mentioned");
assertFileContains("REPORT.md", "Playbook", "Playbook mentioned");
assertFileContains("REPORT.md", "10,000", "10k line reference");

// ---- Summary ----
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);

if (failed > 0) {
  console.error('VALIDATION FAILED');
  process.exit(1);
} else {
  console.log('ALL CHECKS PASSED');
  process.exit(0);
}
