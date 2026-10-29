#!/usr/bin/env bash
# MMS dependency/catalog audit.
#
# Exits non-zero on a real problem:
#   1. Node runtime below the engines floor (>=24.14.0)
#   2. a `catalog:` reference with no matching pnpm-workspace.yaml catalog entry
#   3. `pnpm audit --audit-level=high` reporting advisories
#
# Set MMS_SKIP_AUDIT=1 to skip only the network audit (offline/CI-cache cases).
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
cd "$ROOT_DIR"

FAILED=0
echo "🔍 Auditing dependencies, catalogs & engines…"

# 1. Engine verification -------------------------------------------------------
echo "• Verifying Node and pnpm engines…"
node -e '
const semver = process.versions.node;
const [major, minor] = semver.split(".").map(Number);
if (major < 24 || (major === 24 && minor < 14)) {
  console.error(`✗ Unsupported Node.js v${semver} — engines require >=24.14.0`);
  process.exit(1);
}
console.log(`  Node.js v${semver} meets engines (>=24.14.0)`);
' || FAILED=1

node -e '
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const wanted = (JSON.parse(fs.readFileSync("package.json", "utf8")).packageManager || "").split("@")[1];
if (!wanted) process.exit(0);
const actual = execSync("pnpm --version", { encoding: "utf8" }).trim();
if (actual !== wanted) {
  console.error(`✗ pnpm ${actual} does not match packageManager ${wanted}`);
  process.exit(1);
}
console.log(`  pnpm ${actual} matches packageManager`);
' || FAILED=1

# 2. Catalog consistency -------------------------------------------------------
# Every `catalog:` reference must resolve to a pnpm-workspace.yaml catalog entry —
# a dangling reference installs nothing and fails later, at build time.
echo "• Verifying pnpm-workspace.yaml catalog coverage…"
node -e '
const fs = require("node:fs");
const path = require("node:path");

const catalogSource = fs.readFileSync("pnpm-workspace.yaml", "utf8");
const catalogBlock = catalogSource.split(/^catalog:\s*$/m)[1];
if (!catalogBlock) {
  console.error("✗ pnpm-workspace.yaml has no `catalog:` block");
  process.exit(1);
}
const catalogEntries = new Set();
for (const line of catalogBlock.split("\n")) {
  const match = line.match(/^\s{2}([^:\s]+):\s*\S/);
  if (match) catalogEntries.add(match[1].replace(/^[\x27"]|[\x27"]$/g, ""));
  if (/^\S/.test(line) && line.trim() !== "") break; // left the catalog block
}
console.log(`  catalog defines ${catalogEntries.size} package(s)`);

const manifests = ["package.json"];
for (const group of ["apps", "packages"]) {
  for (const dir of fs.readdirSync(group)) {
    const candidate = path.join(group, dir, "package.json");
    if (fs.existsSync(candidate)) manifests.push(candidate);
  }
}
if (fs.existsSync("e2e/package.json")) manifests.push("e2e/package.json");

const dangling = [];
for (const manifest of manifests) {
  const pkg = JSON.parse(fs.readFileSync(manifest, "utf8"));
  for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
    for (const [name, range] of Object.entries(pkg[field] ?? {})) {
      if (range === "catalog:" && !catalogEntries.has(name)) {
        dangling.push(`${manifest}: ${name} → catalog: (no catalog entry)`);
      }
    }
  }
}
if (dangling.length) {
  console.error("✗ Dangling catalog references:");
  for (const entry of dangling) console.error(`    ${entry}`);
  process.exit(1);
}
console.log("  all `catalog:` references resolve");
' || FAILED=1

# 3. Security audit ------------------------------------------------------------
if [[ "${MMS_SKIP_AUDIT:-0}" == "1" ]]; then
  echo "• Skipping pnpm audit (MMS_SKIP_AUDIT=1)"
else
  echo "• Running pnpm audit (high and critical)…"
  if ! pnpm audit --prod --audit-level high; then
    echo "✗ pnpm audit reported high/critical advisories."
    echo "  Review, then either bump the dependency or add a reviewed exception with its reachability analysis"
    echo "  (see the `overrides` block rationale in pnpm-workspace.yaml)."
    FAILED=1
  fi
fi

if [[ "$FAILED" -ne 0 ]]; then
  echo "❌ Dependency audit FAILED."
  exit 1
fi
echo "✅ Dependency audit passed (engines, catalog references, advisories)."
