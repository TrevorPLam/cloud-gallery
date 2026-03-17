#!/usr/bin/env node
/**
 * Fails if any test file contains .only, describe.skip, it.skip, or test.skip.
 * Used by CI to prevent committing focused or skipped tests.
 */
const fs = require("fs");
const path = require("path");

const patterns = [
  { re: /\.only\s*\(/g, name: ".only" },
  { re: /describe\.skip\s*\(/g, name: "describe.skip" },
  { re: /it\.skip\s*\(/g, name: "it.skip" },
  { re: /test\.skip\s*\(/g, name: "test.skip" },
];

function walkDir(dir, fileList = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (
        e.name !== "node_modules" &&
        e.name !== ".git" &&
        e.name !== "coverage" &&
        e.name !== "dist" &&
        e.name !== "build" &&
        e.name !== "research"
      ) {
        walkDir(full, fileList);
      }
    } else if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(e.name)) {
      fileList.push(full);
    }
  }
  return fileList;
}

const root = path.resolve(__dirname, "..");
const testFiles = walkDir(root);

// Files with documented intentional .skip / .only (to be addressed or in 99_EXCEPTIONS)
const excludedRel = new Set([
  "server/services/sync.test.ts", // Phase 4: skipped conflict/delta tests
  "server/services/smart-albums.test.ts", // Phase 4: skipped idempotence property test
]);

const violations = [];

for (const file of testFiles) {
  const content = fs.readFileSync(file, "utf8");
  const rel = path.relative(root, file).replace(/\\/g, "/");
  if (excludedRel.has(rel)) continue;
  for (const { re, name } of patterns) {
    if (re.test(content)) {
      violations.push({ file: rel, pattern: name });
    }
  }
}

if (violations.length > 0) {
  console.error("Found focused or skipped tests (remove before commit):");
  violations.forEach(({ file, pattern }) =>
    console.error(`  ${file}: ${pattern}`),
  );
  process.exit(1);
}

console.log("No focused or skipped tests found.");
process.exit(0);
