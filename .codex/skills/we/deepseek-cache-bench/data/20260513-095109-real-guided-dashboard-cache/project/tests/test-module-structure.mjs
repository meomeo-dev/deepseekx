// Module structure invariants — import ordering, no duplicate declarations,
// no excessive line compression, metadata objects are readable.

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(__dirname, "../src/app.js"), "utf-8");
const lines = src.split("\n");

let passed = 0, failed = 0, total = 0;
function assert(condition, label) {
  total++;
  if (condition) passed++;
  else { failed++; console.error(`  FAIL: ${label}`); }
}
function eq(actual, expected, label) {
  total++;
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) passed++;
  else { failed++; console.error(`  FAIL: ${label} — expected ${e}, got ${a}`); }
}
function fail(label) { total++; failed++; console.error(`  FAIL: ${label}`); }

const MAX_LINE_LENGTH = 110;

console.log("=== Module Structure Tests ===\n");

// 1. First line is comment or import
const firstLine = lines[0].trim();
assert(
  firstLine.startsWith("//") || firstLine.startsWith("import"),
  `First line is comment or import: "${firstLine.slice(0, 60)}"`
);

// 2. All imports before any executable code.
//    Find the character position where the last import statement ends.
const importBlockEnd = findImportBlockEnd(src);
const firstExecPos = findFirstExecutablePos(src, importBlockEnd);
assert(
  firstExecPos >= importBlockEnd,
  `All imports before executable code (imports end at pos ${importBlockEnd}, first exec at ${firstExecPos})`
);

function findImportBlockEnd(source) {
  // Find the last `from "..."` or `from '...'` that closes an import
  const fromMatches = [...source.matchAll(/from\s+["'][^"']+["']/g)];
  if (fromMatches.length === 0) return 0;
  const lastFrom = fromMatches[fromMatches.length - 1];
  return lastFrom.index + lastFrom[0].length;
}

function findFirstExecutablePos(source, afterPos) {
  // After the import block, find the first meaningful code line
  const afterSrc = source.slice(afterPos);
  const match = afterSrc.match(/^(?:\s*\/\/[^\n]*\n|\s*\n)*(\S)/m);
  return match ? afterPos + match.index + match[0].length - 1 : source.length;
}

// 3. No imports after line 38
const importsAfter = [];
for (let i = 38; i < lines.length; i++) {
  if (lines[i].trim().startsWith("import ")) importsAfter.push(i + 1);
}
eq(importsAfter.length, 0,
  `No imports after line 38: ${importsAfter.length ? "found L" + importsAfter.join(",") : "none"}`);

// 4. No duplicate top-level const declarations
const constDecls = {};
const duplicates = [];
for (let i = 0; i < lines.length; i++) {
  const match = lines[i].match(/^const\s+(\w+)\s*=/);
  if (match) {
    const name = match[1];
    if (constDecls[name] !== undefined) {
      duplicates.push(`${name} at L${constDecls[name] + 1} and L${i + 1}`);
    } else {
      constDecls[name] = i;
    }
  }
}
eq(duplicates.length, 0,
  `No duplicate const: ${duplicates.join("; ") || "none"}`);

// 5. fixtures declared exactly once
const fixturesCount = (src.match(/^const fixtures =/gm) || []).length;
eq(fixturesCount, 1,
  `Exactly 1 'const fixtures' (found ${fixturesCount})`);

// 6. attachFixtures called exactly once
const attachCount = (src.match(/attachFixtures/g) || []).length;
eq(attachCount, 1,
  `Exactly 1 attachFixtures call (found ${attachCount})`);

// 7. IIFE closes the file
const lastNonEmpty = lines.filter(l => l.trim().length > 0).pop() || "";
assert(
  lastNonEmpty.includes("})();") || lastNonEmpty.includes("})()"),
  `Last non-empty line closes IIFE: "${lastNonEmpty.slice(0, 40)}"`
);

// 8. No code after IIFE closing
const iifeClose = src.lastIndexOf("})();");
if (iifeClose >= 0) {
  const afterIIFE = src.slice(iifeClose + 5).trim();
  assert(
    afterIIFE.length === 0,
    `No code after IIFE: "${afterIIFE.slice(0, 60)}"`
  );
}

// 9. Import-to-export name matching
const importMatches = [...src.matchAll(/import\s+\{([^}]+)\}\s+from\s+"([^"]+)"/g)];
for (const m of importMatches) {
  const names = m[1].split(",").map(n => n.trim()).filter(n => n.length > 0);
  const modulePath = resolve(__dirname, "..", "src", m[2]);
  let actualPath = modulePath;
  if (!actualPath.endsWith(".js") && !actualPath.endsWith(".mjs")) {
    actualPath += ".js";
  }
  try {
    const modSrc = readFileSync(actualPath, "utf-8");
    for (const name of names) {
      const exported = new RegExp(`export\\s+(function|class|const|let|var)\\s+${name}\\b`);
      const reExported = new RegExp(`export\\s+\\{[^}]*\\b${name}\\b[^}]*\\}`);
      assert(
        exported.test(modSrc) || reExported.test(modSrc),
        `Import "${name}" from "${m[2]}" has matching export`
      );
    }
  } catch (e) {
    if (e.code !== "ENOENT") {
      console.error(`  WARN: Could not check ${m[2]}: ${e.message}`);
    }
  }
}

// 10. No excessively long lines
const longLines = [];
for (let i = 0; i < lines.length; i++) {
  const len = lines[i].length;
  if (len > MAX_LINE_LENGTH) longLines.push({ line: i + 1, length: len });
}
if (longLines.length > 0) {
  const details = longLines.map(l => `L${l.line}(${l.length}c)`).join(", ");
  fail(`Excessive line length (>${MAX_LINE_LENGTH}c): ${details}`);
} else {
  assert(true, `No lines exceed ${MAX_LINE_LENGTH} characters`);
}

// 11. Metadata objects are not compressed into single lines
function checkMetadataReadable(objectName) {
  const startIdx = lines.findIndex(l => l.trim().startsWith(`const ${objectName} = {`));
  if (startIdx === -1) return;
  const blockSrc = src.slice(
    lines.slice(0, startIdx).join("\n").length
  );
  const endMatch = blockSrc.match(/\n\};\n/);
  if (!endMatch) { fail(`${objectName} closing not found`); return; }
  const endIdx = startIdx + blockSrc.slice(0, endMatch.index).split("\n").length;
  const blockLines = endIdx - startIdx + 1;
  const blockText = lines.slice(startIdx, endIdx + 1).join("\n");
  // Count only top-level keys (lines matching "  key:" at root indent of the object)
  const keyLines = lines.slice(startIdx + 1, endIdx).filter(l => /^\s{2}\w+\s*:/.test(l)).length;
  const keyCount = keyLines;
  if (blockLines >= keyCount) {
    assert(true, `${objectName} is readable (${blockLines} lines for ~${keyCount} entries)`);
  } else {
    fail(`${objectName} compressed: ${blockLines} lines for ~${keyCount} entries`);
  }
}
checkMetadataReadable("TITLES");
checkMetadataReadable("RENDERERS");
checkMetadataReadable("SORT_FIELDS");

// 12. render-command.js exports correct name
const cmdSrc = readFileSync(
  resolve(__dirname, "../scripts/render-command.js"), "utf-8"
);
assert(
  /export function renderCommand\b/.test(cmdSrc),
  "render-command.js exports 'renderCommand'"
);

console.log(`\n=== Results: ${passed}/${total} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
