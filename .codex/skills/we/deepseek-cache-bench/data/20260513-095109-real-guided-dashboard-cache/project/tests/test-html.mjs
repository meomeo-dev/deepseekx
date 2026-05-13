// Northstar Ops Console — HTML structure invariant tests.
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(__dirname, "../index.html"), "utf-8");

let passed = 0, failed = 0, total = 0;

function assert(condition, label) { total++; if (condition) passed++; else { failed++; console.error(`  FAIL: ${label}`); } }
function eq(actual, expected, label) { total++; const a = JSON.stringify(actual), e = JSON.stringify(expected); if (a === e) passed++; else { failed++; console.error(`  FAIL: ${label} — expected ${e}, got ${a}`); } }

const SECTION_NAMES = [
  "summary", "revenue", "funnel", "retention",
  "health", "support", "incidents", "experiments", "deployments",
  "billing", "forecasts", "usage", "account", "portfolio", "renewals", "command",
];

console.log("=== HTML Structure Tests ===\n");

// 1. Document starts with <!DOCTYPE html> and ends with </html>
assert(html.trimStart().startsWith("<!DOCTYPE html>"), "Starts with DOCTYPE");
assert(html.trimEnd().endsWith("</html>"), "Ends with </html>");

// 2. No content after </html>
const htmlCloseIdx = html.lastIndexOf("</html>");
const afterHtml = html.slice(htmlCloseIdx + 7);
assert(afterHtml.trim().length === 0, "No content after </html>");

// 3. Exactly one <main class="main"> and one </main>
const mainOpens = (html.match(/<main\s+class="main">/g) || []).length;
eq(mainOpens, 1, "Exactly one <main class=\"main\">");
const mainCloses = (html.match(/<\/main>/g) || []).length;
eq(mainCloses, 1, "Exactly one </main>");

// 4. All sections inside <main>
const mainOpen = html.indexOf('<main class="main">');
const mainClose = html.indexOf('</main>');
assert(mainOpen < mainClose, "<main> opens before it closes");
const sectionRegex = /<section\s+class="content[^"]*"\s+id="section-(\w+)"/g;
let match;
const sectionsOutside = [];
while ((match = sectionRegex.exec(html)) !== null) {
  if (match.index < mainOpen || match.index > mainClose) {
    sectionsOutside.push(match[1]);
  }
}
eq(sectionsOutside.length, 0, `No sections outside <main>: ${sectionsOutside.join(", ") || "none"}`);

// 5. Exactly one <nav class="sidebar-nav">
const navOpens = (html.match(/<nav\s+class="sidebar-nav">/g) || []).length;
eq(navOpens, 1, "Exactly one <nav class=\"sidebar-nav\">");

// 6. All nav links inside <nav>
const navOpen = html.indexOf('<nav class="sidebar-nav">');
const navClose = html.indexOf('</nav>');
const navLinkRegex = /<a\s[^>]*data-section="(\w+)"/g;
let navMatch;
const navLinksOutside = [];
while ((navMatch = navLinkRegex.exec(html)) !== null) {
  if (navMatch.index < navOpen || navMatch.index > navClose) {
    navLinksOutside.push(navMatch[1]);
  }
}
eq(navLinksOutside.length, 0, `No nav links outside <nav>: ${navLinksOutside.join(", ") || "none"}`);

// 7. Every SECTION_NAME has exactly one id="section-*"
for (const name of SECTION_NAMES) {
  const sectionCount = (html.match(new RegExp(`id="section-${name}"`, "g")) || []).length;
  eq(sectionCount, 1, `Exactly one id="section-${name}"`);
  const expectedNav = name === "account" ? 0 : 1;
  const navCount = (html.match(new RegExp(`data-section="${name}"`, "g")) || []).length;
  eq(navCount, expectedNav, `Exactly ${expectedNav} data-section="${name}"`);
}

// 8. No duplicate section IDs
const allIds = html.match(/id="section-(\w+)"/g) || [];
const idMap = {};
for (const idStr of allIds) {
  const id = idStr.match(/section-(\w+)/)[1];
  idMap[id] = (idMap[id] || 0) + 1;
}
const dupes = Object.entries(idMap).filter(([, c]) => c > 1);
eq(dupes.length, 0, `No duplicate section IDs: ${dupes.map(d => d[0]).join(", ") || "none"}`);

// 9. Script placement
const bodyClose = html.indexOf('</body>');
const scriptIdx = html.indexOf('<script type="module"');
const scriptClose = html.indexOf('</script>', scriptIdx);
assert(scriptIdx > mainClose, "Script tag after </main>");
assert(scriptClose < bodyClose, "Script tag before </body>");

// 10. Balanced section tags
const sectionOpens = (html.match(/<section\s/g) || []).length;
const sectionCloses = (html.match(/<\/section>/g) || []).length;
eq(sectionOpens, sectionCloses, `Section tag balance: ${sectionOpens} open / ${sectionCloses} close`);

// 11. <aside> contains <nav>
const asideOpen = html.indexOf('<aside class="sidebar">');
const asideClose = html.indexOf('</aside>');
assert(asideOpen > 0, "<aside> exists");
assert(asideOpen < navOpen, "<aside> contains <nav>");
assert(asideClose > navClose, "</aside> closes after </nav>");

// 12. Section count in <main>
const sectionsInMain = html.slice(mainOpen, mainClose);
const sectionCount = (sectionsInMain.match(/<section\s/g) || []).length;
eq(sectionCount, 16, "16 section elements in <main>");

// 13. Single body
const bodyOpens = (html.match(/<body>/g) || []).length;
eq(bodyOpens, 1, "Exactly one <body>");
const bodyCloses = (html.match(/<\/body>/g) || []).length;
eq(bodyCloses, 1, "Exactly one </body>");

console.log(`\n=== Results: ${passed}/${total} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
