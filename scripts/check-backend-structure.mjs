#!/usr/bin/env node
/**
 * Backend structural ratchets — the ports-and-adapters seam.
 *
 * `scripts/check-backend-boundaries.mjs` guards the *route* edge (routes must not
 * import `db/repositories`/`drizzle-orm`). This script guards the rest of the
 * documented chain `routes → use-cases → ports → adapters → db/repositories (SQL)`:
 *
 *   1. `useCaseStorageImports` — use-case files must reach storage only through the
 *      module's adapter, not by importing `db/repositories/**` / `drizzle-orm`.
 *   2. `servicesStorageImports` — same rule for the `services/` layer.
 *   3. `servicesReexportShims` — `services/` must not contain pure one-line re-export
 *      shims; canonical paths win.
 *   4. `routeAggregatorFiles` — `routes/tenant/{module}.ts` module-aggregator files are
 *      being folded into `routes/tenant/{module}/` (folder-per-module).
 *
 * Ratchets, not cleanups: existing sites are grandfathered via BASELINE; lowering a
 * baseline as the seam tightens is always welcome.
 *
 *   node scripts/check-backend-structure.mjs [--json] [--update-baselines]
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BACKEND_SRC = path.join(ROOT, "apps/backend/src");
const SERVICES_DIR = path.join(BACKEND_SRC, "services");
const TENANT_ROUTES_DIR = path.join(BACKEND_SRC, "routes/tenant");

const BASELINE = {
  useCaseStorageImports: 48,
  servicesStorageImports: 66,
  servicesReexportShims: 0,
  routeAggregatorFiles: 17,
};

/** Route-aggregator files that are intentionally not `{module}` folders. */
const SANCTIONED_TENANT_ROUTE_FILES = [/SetupConfigRoutes\.ts$/, /^moduleAccess\.ts$/, /^tasks/];

const toRel = (p) => path.relative(ROOT, p).split(path.sep).join("/");
const isTest = (rel) => /\.(test|spec)\.ts$/.test(rel) || rel.includes("/__tests__/");

function walkTs(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkTs(full, out);
    else if (entry.name.endsWith(".ts") && !isTest(toRel(full))) out.push(full);
  }
  return out;
}

const STORAGE_SPECIFIER = (specifier) =>
  specifier.includes("db/repositories/") ||
  specifier === "drizzle-orm" ||
  specifier.startsWith("drizzle-orm/");

function storageImports(source) {
  const hits = [];
  for (const line of source.split("\n")) {
    const m =
      line.match(/\bfrom\s+["']([^"']+)["']/) ??
      line.match(/^\s*import\s+["']([^"']+)["']/) ??
      line.match(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/);
    if (m && STORAGE_SPECIFIER(m[1])) hits.push(m[1]);
  }
  return hits;
}

// --- Norms 1 & 2: use-case / services storage imports -----------------------
const useCaseStorageImports = [];
const servicesStorageImports = [];
for (const file of walkTs(BACKEND_SRC)) {
  const rel = toRel(file);
  const hits = storageImports(fs.readFileSync(file, "utf8"));
  if (hits.length === 0) continue;
  if (rel.includes("/use-cases/")) useCaseStorageImports.push(rel);
  else if (rel.includes("/services/")) servicesStorageImports.push(rel);
}

// --- Norm 3: pure re-export shims in services/ -----------------------------
const servicesReexportShims = fs
  .readdirSync(SERVICES_DIR, { withFileTypes: true })
  .filter((e) => e.isFile() && e.name.endsWith(".ts") && !isTest(e.name))
  .filter((e) => {
    const lines = fs
      .readFileSync(path.join(SERVICES_DIR, e.name), "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter(
        (l) =>
          l &&
          !l.startsWith("//") &&
          !l.startsWith("/*") &&
          !l.startsWith("*") &&
          !l.startsWith("*/"),
      );
    return lines.length > 0 && lines.every((l) => /^export\b/.test(l) && /\bfrom\b/.test(l));
  })
  .map((e) => toRel(path.join(SERVICES_DIR, e.name)));

// --- Norm 4: route aggregator files -----------------------------------------
const routeAggregatorFiles = fs
  .readdirSync(TENANT_ROUTES_DIR, { withFileTypes: true })
  .filter((e) => e.isFile() && e.name.endsWith(".ts") && !isTest(e.name))
  .filter((e) => !SANCTIONED_TENANT_ROUTE_FILES.some((re) => re.test(e.name)))
  .map((e) => toRel(path.join(TENANT_ROUTES_DIR, e.name)));

const results = [
  {
    name: "use-case files importing db/repositories or drizzle-orm directly",
    norm: "SYSTEM_ARCHITECTURE.md §5 (ports & adapters)",
    count: useCaseStorageImports.length,
    baseline: BASELINE.useCaseStorageImports,
    sample: useCaseStorageImports.slice(0, 8),
  },
  {
    name: "services/ files importing db/repositories or drizzle-orm directly",
    norm: "SYSTEM_ARCHITECTURE.md §5 (ports & adapters)",
    count: servicesStorageImports.length,
    baseline: BASELINE.servicesStorageImports,
    sample: servicesStorageImports.slice(0, 8),
  },
  {
    name: "Pure re-export shims in services/",
    norm: "mms-structure-naming.md §1",
    count: servicesReexportShims.length,
    baseline: BASELINE.servicesReexportShims,
    sample: servicesReexportShims.slice(0, 8),
  },
  {
    name: "routes/tenant/{module}.ts aggregator files (fold into {module}/)",
    norm: "mms-structure-naming.md §1",
    count: routeAggregatorFiles.length,
    baseline: BASELINE.routeAggregatorFiles,
    sample: routeAggregatorFiles.slice(0, 8),
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
    const scriptPath = path.join(ROOT, "scripts/check-backend-structure.mjs");
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
    "💥 backend-structure ratchet(s) regressed. Route use-case/services storage access through the module adapter, avoid pure services/ shims, and keep tenant routes folder-per-module — or lower the BASELINE in scripts/check-backend-structure.mjs with a reviewed reason.",
  );
  process.exit(1);
}
console.log("✅ All backend-structure ratchets held.");
