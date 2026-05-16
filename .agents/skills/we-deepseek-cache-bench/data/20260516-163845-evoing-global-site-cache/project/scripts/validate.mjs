import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
let failures = 0, checks = 0;
function assert(c, m) { checks++; if (!c) { console.error(`  FAIL  ${m}`); failures++; } else console.log(`  PASS  ${m}`); }
async function readJson(p) { return JSON.parse(await readFile(join(ROOT, p), 'utf-8')); }
async function readText(p) { return readFile(join(ROOT, p), 'utf-8'); }

console.log('\n=== Evoing Site Validation ===\n');
console.log('1. Files');
const files = [
  'package.json','server.mjs','scripts/validate.mjs','src/index.html',
  'src/css/brand.css','src/css/layout.css','src/css/components.css','src/css/main.css',
  'src/css/methodology.css','src/css/industry-detail.css','src/css/leadership.css',
  'src/css/solutions.css','src/css/case-studies.css','src/css/articles.css','src/css/offices.css','src/css/careers.css',
  'src/css/trust.css','src/css/journeys.css','src/css/resources.css','src/css/partners.css','src/css/brand-assets.css',
  'src/css/value-calc.css','src/css/briefings.css','src/css/delivery-model.css',
  'src/js/i18n.js','src/js/navigation.js','src/js/filter.js','src/js/main.js',
  'src/js/articles.js','src/js/contact.js','src/js/methodology.js','src/js/industry-detail.js',
  'src/js/solutions.js','src/js/case-studies.js','src/js/offices.js','src/js/careers.js',
  'src/js/trust.js','src/js/journeys.js','src/js/resources.js','src/js/partners.js','src/js/brand-assets.js',
  'src/js/value-calc.js','src/js/briefings.js','src/js/delivery-model.js',
  'src/data/navigation.json','src/data/capabilities.json','src/data/industries.json','src/data/regions.json',
  'src/data/cases.json','src/data/methodology.json','src/data/service-catalog.json',
  'src/data/industry-deep.json','src/data/insights.json','src/data/leadership.json',
  'src/data/solutions.json','src/data/case-studies.json','src/data/articles.json','src/data/offices.json','src/data/careers.json',
  'src/data/trust.json','src/data/client-journeys.json','src/data/resources.json','src/data/partners.json','src/data/brand-assets.json',
  'src/data/value-models.json','src/data/briefings.json','src/data/delivery-model.json'
];
for (const f of files) { const e = await readFile(join(ROOT, f)).then(()=>true).catch(()=>false); assert(e, `${f}`); }

console.log('\n2. JSON');
async function checkJson(p, validate) { try { const d = await readJson(p); validate(d); } catch(e) { assert(false, `${p}: ${e.message}`); } }
await checkJson('src/data/case-studies.json', d => { assert(Array.isArray(d) && d.length >= 10, 'case-studies >= 10'); d.forEach((c,i) => { assert(c.overview && c.challengeBullets && c.interventionPhases && c.architectureDetail && c.results && c.clientQuote && c.teamModel, `case[${i}] has deep fields`); }); });
await checkJson('src/data/articles.json', d => { assert(Array.isArray(d) && d.length >= 12, 'articles >= 12'); d.forEach((a,i) => { assert(a.keyTakeaways && a.relatedCapabilities, `article[${i}] has keyTakeaways+relatedCaps`); }); });
await checkJson('src/data/resources.json', d => { assert(Array.isArray(d) && d.length >= 12, 'resources >= 12'); d.forEach((r,i) => { assert(r.audience && r.whatYouWillLearn, `resource[${i}] has audience+whatYouWillLearn`); }); });
await checkJson('src/data/solutions.json', d => { assert(Array.isArray(d) && d.length >= 8, 'solutions >= 8'); });
await checkJson('src/data/value-models.json', d => { assert(d.scenarios && d.scenarios.length === 4, 'value-models 4 scenarios'); });
await checkJson('src/data/briefings.json', d => { assert(d.roles && d.objectives && d.industries, 'briefings has roles+objectives+industries'); });
await checkJson('src/data/delivery-model.json', d => { assert(d.engagementModels && d.globalDeliveryCenters && d.governanceFramework, 'delivery-model has all sections'); });
await checkJson('src/data/trust.json', d => { assert(d.pillars && d.certifications, 'trust ok'); });
await checkJson('src/data/partners.json', d => { assert(d.categories && d.collaborationModels, 'partners ok'); });
await checkJson('src/data/capabilities.json', d => { assert(d.length >= 6, 'caps ok'); });
await checkJson('src/data/industries.json', d => { assert(d.length === 8, 'inds ok'); });

console.log('\n3. HTML sections');
const html = await readText('src/index.html');
for (const id of ['hero','capabilities','trust','solutions','services','methodology','value-calc','case-studies','journeys','briefings','industries','partners','delivery','offices','insights','resources','leadership','brand','careers-sec','contact']) {
  assert(html.includes(`id="${id}"`), `#${id}`);
}

console.log('\n4. JS depth');
const trustJS = await readText('src/js/trust.js'); assert(trustJS.length > 100, 'trust.js > 100 chars');
const partnersJS = await readText('src/js/partners.js'); assert(partnersJS.length > 100, 'partners.js > 100 chars');
const brandJS = await readText('src/js/brand-assets.js'); assert(brandJS.length > 100, 'brand-assets.js > 100 chars');
const vcJS = await readText('src/js/value-calc.js'); assert(vcJS.includes('recalc') && vcJS.length > 500, 'value-calc.js has recalc logic');
const bfJS = await readText('src/js/briefings.js'); assert(bfJS.includes('updateResult') && bfJS.length > 500, 'briefings.js interactive');
const dmJS = await readText('src/js/delivery-model.js'); assert(dmJS.length > 100, 'delivery-model.js > 100 chars');

console.log('\n5. Business rules');
const caps = await readJson('src/data/capabilities.json'); const capIds = caps.map(c=>c.id);
const inds = await readJson('src/data/industries.json'); const indIds = inds.map(i=>i.id);
const cases = await readJson('src/data/case-studies.json');
cases.forEach(c => { assert(indIds.includes(c.industry), `case ${c.id} ind`); });
const sols = await readJson('src/data/solutions.json');
sols.forEach(s => { s.relatedCapabilities.forEach(rc => assert(capIds.includes(rc), `sol ${s.id} cap ${rc}`)); });

console.log('\n6. Server');
const srv = await readText('server.mjs'); assert(srv.includes('0.0.0.0') && srv.includes('5173'), 'server ok');

console.log('\n7. Line count');
async function cl(p) { return (await readText(p)).split('\n').length; }
let total = 0;
for (const f of files) { const l = await cl(f); total += l; console.log(`  ${String(l).padStart(5)}  ${f}`); }
console.log(`  -----`);
console.log(`  ${String(total).padStart(5)}  TOTAL`);

console.log(`\n=== Summary ===`);
console.log(`  Checks: ${checks}  Passed: ${checks-failures}  Failed: ${failures}`);
if (total < 8500) { console.log(`\n  FAIL: first-party lines (${total}) below 8,500 target.`); process.exit(1); }
else if (total < 10000) console.log(`  WARNING: first-party lines (${total}) below 10,000 final target.`);
else console.log(`  PASS: first-party lines (${total}) >= 10,000.`);
if (failures > 0) { console.log('\n  FAILED.'); process.exit(1); }
else console.log('\n  PASSED.');
