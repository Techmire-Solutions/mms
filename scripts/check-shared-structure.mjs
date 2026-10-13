#!/usr/bin/env node
/**
 * `@mms/shared` structural ratchets.
 *
 * Guards the de-flattening of packages/shared so it cannot silently regress:
 *
 *   1. `packages/shared/src/` root holds only the public barrel (`index.ts`).
 *      Domain code lives under `src/<domain>/` (mms-structure-naming §1).
 *   2. Consumers import `@mms/shared` (root) or the explicitly exported subpaths
 *      only — never a deep `@mms/shared/src/...` / `dist/...` path (README policy,
 *      the `exports` map is the contract).
 *
 *   node scripts/check-shared-structure.mjs
 *   node scripts/check-shared-structure.mjs --json
 *   node scripts/check-shared-structure.mjs --update-baselines
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SHARED_SRC = path.join(ROOT, "packages/shared/src");

/** Files allowed directly under packages/shared/src/. */
const ROOT_ALLOWLIST = new Set(["index.ts"]);
/** Subpath exports the package exposes (see packages/shared/package.json `exports`). */
const EXPORTED_SUBPATHS = new Set([
  "tenantUtils",
  "translations/en",
  "translations/ar",
  "translations/ur",
  "translations/fa",
]);
const CONSUMER_DIRS = ["apps/backend/src", "apps/frontend/src", "e2e"];

const BASELINE = {
  flatRootFiles: 0,
  unlistedSubpathImports: 0,
};

const toRel = (p) => path.relative(ROOT, p).split(path.sep).join("/");
const isDir = (p) => {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};

function walkFiles(dir, out = []) {
  if (!isDir(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "coverage")
      continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

// --- Norm 1: flat src/ root -----------------------------------------------
const flatRootFiles = fs
  .readdirSync(SHARED_SRC, { withFileTypes: true })
  .filter((e) => e.isFile() && /\.(ts|tsx)$/.test(e.name) && !ROOT_ALLOWLIST.has(e.name))
  .map((e) => toRel(path.join(SHARED_SRC, e.name)));

// --- Norm 2: consumers must not deep-import @mms/shared --------------------
const SUBPATH_IMPORT = /["']@mms\/shared\/([^"']+)["']/g;
const unlistedSubpathImports = [];
for (const dir of CONSUMER_DIRS) {
  for (const file of walkFiles(path.join(ROOT, dir))) {
    const content = fs.readFileSync(file, "utf8");
    for (const match of content.matchAll(SUBPATH_IMPORT)) {
      const sub = match[1];
      if (!EXPORTED_SUBPATHS.has(sub))
        unlistedSubpathImports.push(`${toRel(file)} → @mms/shared/${sub}`);
    }
  }
}

const results = [
  {
    name: "Files directly under packages/shared/src/ root (only index.ts allowed)",
    norm: "mms-structure-naming.md §1",
    count: flatRootFiles.length,
    baseline: BASELINE.flatRootFiles,
    sample: flatRootFiles.slice(0, 8),
  },
  {
    name: "Consumer imports of unexported @mms/shared subpaths",
    norm: "packages/shared/README.md (exports contract)",
    count: unlistedSubpathImports.length,
    baseline: BASELINE.unlistedSubpathImports,
    sample: unlistedSubpathImports.slice(0, 8),
  },
];

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ results }, null, 2));
  process.exit(0);
}

if (process.argv.includes("--update-baselines")) {
  const newBaseline = { ...BASELINE };
  let updated = false;
  results.forEach((result, index) => {
    if (result.count < result.baseline) {
      newBaseline[Object.keys(BASELINE)[index]] = result.count;
      updated = true;
    }
  });
  if (updated) {
    const scriptPath = path.join(ROOT, "scripts/check-shared-structure.mjs");
    const content = fs.readFileSync(scriptPath, "utf8");
    const literal = `const BASELINE = {\n${Object.entries(newBaseline)
      .map(([k, v]) => `  ${k}: ${v},`)
      .join("\n")}\n};`;
    fs.writeFileSync(
      scriptPath,
      content.replace(/const BASELINE = \{[\s\S]*?\};/, literal),
      "utf8",
    );
    console.log("✅ Baselines ratcheted down:", newBaseline);
  } else {
    console.log("ℹ️ No baseline improvements to update.");
  }
  process.exit(0);
}

let regressions = 0;
for (const result of results) {
  const delta = result.count - result.baseline;
  console.log(
    `${delta > 0 ? "✗" : "✓"} ${result.name}: ${result.count} (baseline ${result.baseline})  [${result.norm}]`,
  );
  if (delta < 0 && result.baseline > 0) {
    console.log(
      `   🎉 Improved by ${Math.abs(delta)}! Run with --update-baselines to ratchet down.`,
    );
  }
  if (delta > 0) {
    regressions++;
    for (const site of result.sample) console.log(`      ${site}`);
  }
}

console.log("");
if (regressions > 0) {
  console.error(
    "💥 shared-structure ratchet(s) regressed. Move domain code under src/<domain>/ and add the export to packages/shared/package.json, or — with a reviewed reason — lower the BASELINE in scripts/check-shared-structure.mjs.",
  );
  process.exit(1);
}
console.log("✅ All shared-structure ratchets held.");
