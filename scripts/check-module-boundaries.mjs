#!/usr/bin/env node
/**
 * Module audience boundary ratchet.
 *
 * Enforces the package-level contract for `packages/modules/*`:
 *   shared   → contracts, tooling only (pure, FE+BE safe)
 *   backend  → contracts, db, be-core, tooling, own shared
 *   frontend → contracts, fe-core, ui, tooling, own shared
 *   no module may import another module; no consumer may import a module root
 *   apps never import a module's backend audience from a frontend app.
 *
 * `apps/tenant-web` is the interim hybrid console host while `src/platform/**` still
 * lives there: app-wide it may import either frontend audience, but its `src/tenant/**`
 * and `src/platform/**` subtrees keep the per-audience restriction. Flip it to
 * `"tenant"` once platform code has migrated to `apps/platform-web`.
 *
 * The ESLint probe test (`scripts/ci/module-audience-boundaries.test.mjs`) proves
 * the specifier-level `no-restricted-imports` rules; this script guards the
 * package source itself and adds a fail-closed check for future apps.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MODULES_DIR = path.join(ROOT, "packages/modules");
const IGNORED = /(^|\/)(node_modules|dist|coverage|\.turbo)\//;
const SOURCE = /\.(ts|tsx)$/;
const IMPORT_RE = /(?:from\s+|import\s*\(\s*)(["'])([^"']+)\1/g;

const ALLOWED = {
  shared: new Set(["@mms/contracts"]),
  backend: new Set(["@mms/contracts", "@mms/db", "@mms/be-core"]),
  frontend: new Set(["@mms/contracts", "@mms/fe-core", "@mms/ui"]),
};

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED.test(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const violations = [];
const modules = fs
  .readdirSync(MODULES_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

if (modules.length === 0) {
  violations.push({ file: "packages/modules", reason: "no module packages found" });
}

for (const moduleName of modules) {
  const moduleRoot = path.join(MODULES_DIR, moduleName);
  const audiences = ["shared", "backend", "frontend"];
  for (const audience of audiences) {
    const dir = path.join(moduleRoot, "src", audience);
    if (!fs.existsSync(dir)) continue;
    const files = walk(dir).filter((file) => SOURCE.test(file));
    if (files.length === 0) continue;
    for (const file of files) {
      const rel = path.relative(ROOT, file).split(path.sep).join("/");
      const source = fs.readFileSync(file, "utf8");
      for (const match of source.matchAll(IMPORT_RE)) {
        const spec = match[2];
        if (spec.startsWith("@/")) {
          violations.push({ file: rel, reason: `app alias import "${spec}"` });
          continue;
        }
        if (spec.startsWith("apps/")) {
          violations.push({ file: rel, reason: `app import "${spec}"` });
          continue;
        }
        if (!spec.startsWith("@mms/")) continue;
        if (spec.startsWith("@mms/mod-")) {
          const own = spec.startsWith(`@mms/mod-${moduleName}/`);
          if (!own) violations.push({ file: rel, reason: `cross-module import "${spec}"` });
          continue;
        }
        if (!ALLOWED[audience].has(spec.split("/").slice(0, 2).join("/"))) {
          violations.push({ file: rel, reason: `audience "${audience}" may not import "${spec}"` });
        }
      }
    }
  }
}

// Current/future frontend apps must never import a module backend subpath or a
// module root. `apps/tenant-web` is hybrid until platform code migrates: app-wide it
// may import either frontend audience, while its tenant/platform subtrees stay
// audience-locked.
const MODULE_ROOT_RE = /^@mms\/mod-[a-z0-9-]+$/;
const MODULE_BACKEND_RE = /^@mms\/mod-[a-z0-9-]+\/backend(\/|$)/;
const MODULE_PLATFORM_FE_RE = /^@mms\/mod-[a-z0-9-]+\/frontend\/platform(\/|$)/;
const MODULE_TENANT_FE_RE = /^@mms\/mod-[a-z0-9-]+\/frontend\/tenant(\/|$)/;
// Both apps are temporarily hybrid: `apps/platform-web` still carries a `src/tenant/**`
// copy and shared `src/lib/**` that imports tenant-audience module code. The subtree
// locks below already keep platform and tenant source separated *inside* each app, so
// the app-wide allowance only covers shared shell code. Flip each app to its single
// audience (`tenant` / `platform`) once the duplicated tenant tree is pruned from
// platform-web — at that point the per-app value becomes the real guard.
const APP_AUDIENCES = {
  "apps/tenant-web": "hybrid",
  "apps/platform-web": "hybrid",
};
const SUBTREE_AUDIENCES = [
  { prefix: "apps/tenant-web/src/tenant/", audience: "tenant" },
  { prefix: "apps/tenant-web/src/platform/", audience: "platform" },
  { prefix: "apps/platform-web/src/tenant/", audience: "tenant" },
  { prefix: "apps/platform-web/src/platform/", audience: "platform" },
];

for (const [app, appAudience] of Object.entries(APP_AUDIENCES)) {
  const dir = path.join(ROOT, app, "src");
  if (!fs.existsSync(dir)) continue;
  for (const file of walk(dir).filter((f) => SOURCE.test(f))) {
    const rel = path.relative(ROOT, file).split(path.sep).join("/");
    const source = fs.readFileSync(file, "utf8");
    const subtree = SUBTREE_AUDIENCES.find((entry) => rel.startsWith(entry.prefix));
    const audience = subtree?.audience ?? appAudience;
    for (const match of source.matchAll(IMPORT_RE)) {
      const spec = match[2];
      if (MODULE_ROOT_RE.test(spec)) {
        violations.push({ file: rel, reason: "module root import is not allowed" });
      }
      if (MODULE_BACKEND_RE.test(spec)) {
        violations.push({ file: rel, reason: `frontend app imported backend audience "${spec}"` });
      }
      if (audience === "tenant" && MODULE_PLATFORM_FE_RE.test(spec)) {
        violations.push({
          file: rel,
          reason: `tenant-facing app imported platform audience "${spec}"`,
        });
      }
      if (audience === "platform" && MODULE_TENANT_FE_RE.test(spec)) {
        violations.push({
          file: rel,
          reason: `platform-facing app imported tenant audience "${spec}"`,
        });
      }
    }
  }
}

if (violations.length > 0) {
  console.error(`✗ ${violations.length} module audience boundary violation(s):`);
  for (const violation of violations.slice(0, 80)) {
    console.error(`  - ${violation.file}: ${violation.reason}`);
  }
  process.exit(1);
}

console.log("✓ Module audience boundaries held (shared/backend/frontend + app restrictions).");
