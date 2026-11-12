#!/usr/bin/env node
/**
 * Finance shared-contract parity ratchet.
 *
 * Two drifts are worth failing the build over:
 *  - a finance/accounting schema module that exists in `packages/shared/src/finance`
 *    but is not exported from the shared barrel (backend and frontend then quietly
 *    grow their own copy), and
 *  - a workspace that stops consuming the catalogued single zod/TypeScript version
 *    or links `@mms/shared` through anything other than `workspace:*`.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const findings = [];

// --- 1. Every finance module is exported from a shared entry file ---------------
const financeDir = path.join(ROOT, "packages/shared/src/finance");
const entryDir = path.join(ROOT, "packages/shared/src/entry");
const financeModules = fs
  .readdirSync(financeDir)
  .filter((name) => name.endsWith(".ts") && !/\.test\.ts$/.test(name))
  .map((name) => name.replace(/\.ts$/, ""));
const exportedModules = new Set();
for (const entry of fs.readdirSync(entryDir)) {
  if (!entry.endsWith(".ts")) continue;
  const content = fs.readFileSync(path.join(entryDir, entry), "utf8");
  for (const match of content.matchAll(
    /export\s+(?:\*|\{[^}]*\})\s+from\s+"\.\.\/finance\/([^"]+)\.js"/g,
  )) {
    exportedModules.add(match[1]);
  }
}
// A module is exported when an entry file exports it or a barrel re-exports it
// (`financeModuleManifest` folds the focused modules; direct entry exports of the
// barrel count too). Resolve the transitive re-export graph inside finance/.
const reexports = new Map();
for (const module of financeModules) {
  const content = fs.readFileSync(path.join(financeDir, `${module}.ts`), "utf8");
  reexports.set(
    module,
    [...content.matchAll(/export\s+(?:\*|\{[^}]*\})\s+from\s+"\.\/([^"]+)\.js"/g)].map(
      (match) => match[1],
    ),
  );
}
const reachable = new Set(exportedModules);
const queue = [...exportedModules];
while (queue.length > 0) {
  const current = queue.pop();
  for (const next of reexports.get(current) ?? []) {
    if (!reachable.has(next)) {
      reachable.add(next);
      queue.push(next);
    }
  }
}
for (const module of financeModules) {
  if (!reachable.has(module)) {
    findings.push(
      `packages/shared/src/finance/${module}.ts is not exported (directly or through a barrel) from packages/shared/src/entry/*`,
    );
  }
}

// --- 2. Single catalogued zod + TypeScript, workspace-linked shared ------------
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8"));
const workspace = fs.readFileSync(path.join(ROOT, "pnpm-workspace.yaml"), "utf8");
const catalogZod = workspace.match(/^\s{2}zod:\s*"?([^"\n]+)"?/m)?.[1];

const packages = [
  "package.json",
  "packages/shared/package.json",
  "apps/backend/package.json",
  "apps/frontend/package.json",
];
const tsVersions = new Set();
for (const relative of packages) {
  const pkg = readJson(relative);
  const zod = pkg.dependencies?.zod ?? pkg.devDependencies?.zod;
  if (zod !== undefined && zod !== "catalog:") {
    findings.push(`${relative}: zod must be "catalog:" (found ${zod})`);
  }
  const ts = pkg.devDependencies?.typescript;
  if (ts) tsVersions.add(ts);
}
if (!catalogZod) findings.push("pnpm-workspace.yaml: no catalogued zod entry");
if (tsVersions.size > 1) findings.push(`TypeScript versions drift: ${[...tsVersions].join(", ")}`);

for (const relative of ["apps/backend/package.json", "apps/frontend/package.json"]) {
  const pkg = readJson(relative);
  const shared = pkg.dependencies?.["@mms/shared"];
  if (shared !== "workspace:*") {
    findings.push(`${relative}: @mms/shared must be "workspace:*" (found ${shared ?? "none"})`);
  }
}

// --- 3. Lockfile resolves exactly one zod -------------------------------------
const lockPath = path.join(ROOT, "pnpm-lock.yaml");
if (fs.existsSync(lockPath)) {
  const lock = fs.readFileSync(lockPath, "utf8");
  const versions = new Set([...lock.matchAll(/^\s{2}zod@([^:\s]+):/gm)].map((match) => match[1]));
  if (versions.size > 1)
    findings.push(`pnpm-lock resolves multiple zod versions: ${[...versions].join(", ")}`);
}

if (findings.length > 0) {
  console.error("✗ Finance contract parity ratchet failed:");
  for (const finding of findings) console.error(`   ${finding}`);
  process.exit(1);
}
console.log(
  `✓ ${financeModules.length} finance modules exported; single zod (${catalogZod}), single TypeScript, workspace-linked shared.`,
);
