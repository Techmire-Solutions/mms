#!/usr/bin/env bash
set -euo pipefail

# MMS @mms/shared SSOT purity auditor.
#
# Fails when the shared package imports a runtime it must not depend on
# (React/Fastify/DB/Redis/Pino) or touches DOM/Node-only globals. The package
# must stay a pure, environment-agnostic leaf so both apps can consume it.
#
# Usage:
#   check-shared-exports.sh            # scan packages/shared/src
#   check-shared-exports.sh <dir>      # scan an alternate source dir (tests)
echo "🔍 Checking @mms/shared SSOT purity & boundaries…"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
cd "$ROOT_DIR"

SHARED_SRC="${1:-packages/shared/src}"
if [[ ! -d "$SHARED_SRC" ]]; then
  echo "✗ Shared source directory not found at $SHARED_SRC"
  exit 1
fi

SHARED_SRC="$SHARED_SRC" node -e '
const fs = require("node:fs");
const path = require("node:path");

const sharedDir = path.resolve(process.env.SHARED_SRC);

function scanDir(dir) {
  let files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files = files.concat(scanDir(full));
    else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) files.push(full);
  }
  return files;
}

// Blanks out comments and string/template/regex literals while preserving
// offsets, so prose inside a doc comment ("… this window.") or a translation
// value ("localStorage") can never be mistaken for a runtime access. Only the
// *code* that remains is scanned for environment-bound globals; imports are
// still checked against the raw source (their specifiers are string literals).
function stripCommentsAndStrings(src) {
  let out = "";
  const n = src.length;
  let i = 0;
  let state = "code";
  let lastMeaningful = "";
  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];
    if (state === "code") {
      if (c === "/" && c2 === "/") { state = "line"; out += "  "; i += 2; continue; }
      if (c === "/" && c2 === "*") { state = "block"; out += "  "; i += 2; continue; }
      if (c === "\x27") { state = "sq"; out += " "; i++; continue; }
      if (c === "\x22") { state = "dq"; out += " "; i++; continue; }
      if (c === "`") { state = "tpl"; out += " "; i++; continue; }
      // A `/` opens a regex literal unless it directly follows an identifier,
      // number, or closing bracket (in which case it is division).
      if (c === "/" && !/[A-Za-z0-9_$)\]}]/.test(lastMeaningful)) {
        state = "regex"; out += " "; i++; continue;
      }
      if (!/\s/.test(c)) lastMeaningful = c;
      out += c; i++; continue;
    }
    if (state === "line") {
      if (c === "\n") { state = "code"; out += "\n"; } else out += " ";
      i++; continue;
    }
    if (state === "block") {
      if (c === "*" && c2 === "/") { state = "code"; out += "  "; i += 2; continue; }
      out += c === "\n" ? "\n" : " "; i++; continue;
    }
    if (state === "sq" || state === "dq") {
      const quote = state === "sq" ? "\x27" : "\x22";
      if (c === "\\") { out += "  "; i += 2; continue; }
      if (c === quote) { state = "code"; out += " "; i++; continue; }
      out += c === "\n" ? "\n" : " "; i++; continue;
    }
    if (state === "tpl") {
      if (c === "\\") { out += "  "; i += 2; continue; }
      if (c === "`") { state = "code"; out += " "; i++; continue; }
      out += c === "\n" ? "\n" : " "; i++; continue;
    }
    if (state === "regex") {
      if (c === "\\") { out += "  "; i += 2; continue; }
      if (c === "[") { state = "regexClass"; out += " "; i++; continue; }
      if (c === "/") { state = "code"; out += " "; i++; continue; }
      if (c === "\n") { state = "code"; out += "\n"; i++; continue; }
      out += " "; i++; continue;
    }
    if (state === "regexClass") {
      if (c === "\\") { out += "  "; i += 2; continue; }
      if (c === "]") { state = "regex"; out += " "; i++; continue; }
      out += " "; i++; continue;
    }
    i++;
  }
  return out;
}

const BANNED_PACKAGES = [
  "react", "react-dom", "fastify", "drizzle-orm", "pg", "postgres",
  "redis", "ioredis", "bullmq", "pino",
];

// Environment-bound globals/APIs: @mms/shared is consumed by both the browser
// bundle and the Node backend, so it may not touch either runtime directly.
const BANNED_USAGE = [
  { pattern: /\bdocument\s*\./, label: "document.* (DOM)" },
  { pattern: /\bwindow\s*\./, label: "window.* (DOM)" },
  { pattern: /\blocalStorage\b/, label: "localStorage" },
  { pattern: /\bsessionStorage\b/, label: "sessionStorage" },
  { pattern: /from\s+["\x27]node:/, label: "node: builtin import" },
  { pattern: /from\s+["\x27](fs|path|crypto|os|child_process)["\x27]/, label: "unprefixed Node builtin import" },
];

const isTestFile = (file) => /\.(test|spec)\.tsx?$/.test(file) || file.split(path.sep).includes("__tests__");

const files = scanDir(sharedDir);
let violations = 0;
let scanned = 0;

for (const file of files) {
  const rel = path.relative(process.cwd(), file);
  const content = fs.readFileSync(file, "utf8");

  for (const pkg of BANNED_PACKAGES) {
    const regex = new RegExp(`from\\s+["\x27]${pkg}(?:/[^"\x27]*)?["\x27]`);
    if (regex.test(content)) {
      console.error(`✗ Boundary violation in ${rel}: forbidden import of "${pkg}"`);
      violations++;
    }
  }

  // Tests may legitimately stub window/localStorage to exercise browser paths.
  if (isTestFile(file)) continue;
  scanned++;

  const code = stripCommentsAndStrings(content);
  for (const { pattern, label } of BANNED_USAGE) {
    if (pattern.test(code)) {
      console.error(`✗ Purity violation in ${rel}: ${label}`);
      violations++;
    }
  }
}

// Date/month validation must use the canonical schemas. An inline
// regex re-derives the shape (and drifts from the isoDateSchema
// real-calendar-date refine); import isoDateSchema / monthKeySchema instead.
const CANONICAL_DATE_FILES = new Set([
  "isoDateSchema.ts",
  "monthKeySchema.ts",
  "billingPeriodSchema.ts",
]);
// Inline date/period validation idioms that drifted from the canonical schemas.
const INLINE_DATE_IDIOMS = [
  /\.regex\(\s*\/\^\\d\{4\}-\\d\{2\}\$/,
  /\.regex\(\s*\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$/,
  /\.regex\(\s*\/\^\\d\{4\}-\(0\[1-9\]\|1\[0-2\]\)\$/,
];
for (const file of files) {
  if (CANONICAL_DATE_FILES.has(path.basename(file))) continue;
  if (isTestFile(file)) continue;
  const src = fs.readFileSync(file, "utf8");
  if (INLINE_DATE_IDIOMS.some((idiom) => idiom.test(src))) {
    console.error(
      `✗ SSOT violation in ${path.relative(process.cwd(), file)}: inline YYYY-MM(-DD) validation regex — use isoDateSchema / monthKeySchema / billingPeriodSchema`,
    );
    violations++;
  }
}

// Canonical schemas must have exactly one definition (SSOT). A contract that
// re-declares one has drifted into a private copy — import it from
// schemas/common.dto.ts instead.
const CANONICAL_SCHEMAS = ["widgetAggregateResultSchema"];
const contractsDir = path.join(sharedDir, "contracts");
if (fs.existsSync(contractsDir)) {
  for (const entry of fs.readdirSync(contractsDir)) {
    if (!entry.endsWith(".contract.ts")) continue;
    const rel = path.relative(process.cwd(), path.join(contractsDir, entry));
    const content = fs.readFileSync(path.join(contractsDir, entry), "utf8");
    for (const schema of CANONICAL_SCHEMAS) {
      if (new RegExp(`const\\s+${schema}\\s*=`).test(content)) {
        console.error(
          `✗ SSOT violation in ${rel}: re-declares canonical "${schema}" (import it from schemas/common.dto.ts)`,
        );
        violations++;
      }
    }
  }
}

if (violations > 0) {
  console.error(`\nFound ${violations} purity violation(s) in @mms/shared.`);
  console.error("Move runtime-specific logic to apps/frontend or apps/backend instead (mms-shared-package, mms-dry.md).");
  process.exit(1);
}
console.log(`  All ${scanned} non-test files in @mms/shared stay pure (no DOM, React, Fastify, DB, Redis, or Node builtins).`);
'

echo "✅ @mms/shared SSOT boundary verified cleanly."
