#!/usr/bin/env node
/**
 * Core-package boundary ratchet.
 *
 * Enforces the dependency contract that ESLint boundaries cannot express fully:
 *
 *   @mms/contracts → no @mms/* workspace imports (pure leaf; tooling is config-only)
 *   @mms/db        → @mms/contracts only
 *   @mms/be-core   → @mms/contracts, @mms/db only (no app / domain / module code)
 *   @mms/fe-core   → @mms/contracts, @mms/ui only (no app / db / be-core / modules)
 *   @mms/ui        → @mms/contracts + its own files; NO router, query client,
 *                    API client, fe-core/be-core/db, app or module imports,
 *                    and no direct fetch/XMLHttpRequest/axios calls.
 *
 * Beyond import specifiers it also asserts, per package:
 *   - the package.json workspace dependencies match the same allowlist
 *     (dev-only @mms tooling configs are exempt);
 *   - no relative import resolves outside the package's own src tree;
 *   - a @mms/fe-core component sharing a basename with a @mms/ui primitive
 *     consumes @mms/ui (adapter/facade) instead of forking the primitive.
 *
 * Fails closed: a missing/empty package or manifest is an error, not a vacuous pass.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PACKAGES = [
  {
    name: "@mms/contracts",
    dir: "packages/contracts/src",
    manifest: "packages/contracts/package.json",
    allowed: [],
  },
  {
    name: "@mms/db",
    dir: "packages/db/src",
    manifest: "packages/db/package.json",
    allowed: ["@mms/contracts"],
  },
  {
    name: "@mms/be-core",
    dir: "packages/be-core/src",
    manifest: "packages/be-core/package.json",
    allowed: ["@mms/contracts", "@mms/db"],
  },
  {
    name: "@mms/fe-core",
    dir: "packages/fe-core/src",
    manifest: "packages/fe-core/package.json",
    allowed: ["@mms/contracts", "@mms/ui"],
  },
  {
    name: "@mms/ui",
    dir: "packages/ui/src",
    manifest: "packages/ui/package.json",
    allowed: ["@mms/contracts"],
  },
];

const FORBIDDEN_UI_SPECIFIERS = [
  { pattern: /^react-router(?:-dom)?(?:\/|$)/, reason: "router dependency" },
  { pattern: /^@tanstack\/react-query(?:\/|$)/, reason: "query-client dependency" },
  { pattern: /^@ts-rest\//, reason: "API-contract client dependency" },
  {
    pattern: /^@mms\/(?:fe-core|be-core|db|modules)(?:\/|$)/,
    reason: "forbidden workspace package",
  },
  { pattern: /^apps\//, reason: "app import" },
];
const FORBIDDEN_UI_APIS = [
  { pattern: /\bfetch\s*\(/, reason: "direct fetch call" },
  { pattern: /\bnew\s+XMLHttpRequest\b/, reason: "direct XHR call" },
  { pattern: /\baxios\b/, reason: "axios dependency" },
];

/** Workspace packages allowed only as dev-time tooling, never as runtime code. */
const DEV_TOOLING_ALLOWED = new Set([
  "@mms/eslint-config",
  "@mms/typescript-config",
  "@mms/tailwind-config",
]);
/** Presentation capabilities @mms/ui must never gain in any dependency field. */
const FORBIDDEN_UI_RUNTIME_DEPS = [
  { pattern: /^react-router(?:-dom)?$/, reason: "router dependency" },
  { pattern: /^@tanstack\/react-query(?:-[a-z-]+)?$/, reason: "query-client dependency" },
  { pattern: /^@ts-rest\//, reason: "API-contract client dependency" },
  { pattern: /^axios$/, reason: "axios dependency" },
];

const IGNORED = /(^|\/)(node_modules|dist|coverage|\.turbo)\//;
const SOURCE = /\.(ts|tsx)$/;
const TEST_FILE = /\.(test|spec)\.(ts|tsx)$/;

function walkFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED.test(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, out);
    else out.push(full);
  }
  return out;
}

const importRe = /(?:from\s+|import\s*\(\s*)(["'])([^"']+)\1/g;
const violations = [];

for (const pkg of PACKAGES) {
  const abs = path.join(ROOT, pkg.dir);
  if (!fs.existsSync(abs)) {
    violations.push({ file: pkg.dir, reason: `${pkg.name} source directory is missing` });
    continue;
  }
  const files = walkFiles(abs).filter((f) => SOURCE.test(f));
  if (files.length === 0) {
    violations.push({ file: pkg.dir, reason: `${pkg.name} has no source files (vacuous pass)` });
    continue;
  }
  const manifestPath = path.join(ROOT, pkg.manifest);
  if (!fs.existsSync(manifestPath)) {
    violations.push({ file: pkg.manifest, reason: `${pkg.name} package.json is missing` });
  } else {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    for (const field of ["dependencies", "peerDependencies", "optionalDependencies"]) {
      for (const dep of Object.keys(manifest[field] ?? {})) {
        if (dep.startsWith("@mms/") && !pkg.allowed.includes(dep)) {
          violations.push({
            file: pkg.manifest,
            reason: `${pkg.name} ${field} may not depend on ${dep} (allowed: ${pkg.allowed.join(", ") || "none"})`,
          });
        }
      }
    }
    for (const dep of Object.keys(manifest.devDependencies ?? {})) {
      if (dep.startsWith("@mms/") && !pkg.allowed.includes(dep) && !DEV_TOOLING_ALLOWED.has(dep)) {
        violations.push({
          file: pkg.manifest,
          reason: `${pkg.name} devDependencies may not include ${dep}`,
        });
      }
    }
    if (pkg.name === "@mms/ui") {
      for (const field of [
        "dependencies",
        "peerDependencies",
        "optionalDependencies",
        "devDependencies",
      ]) {
        for (const dep of Object.keys(manifest[field] ?? {})) {
          const hit = FORBIDDEN_UI_RUNTIME_DEPS.find((r) => r.pattern.test(dep));
          if (hit) {
            violations.push({
              file: pkg.manifest,
              reason: `@mms/ui forbidden ${hit.reason} in ${field}: "${dep}"`,
            });
          }
        }
      }
    }
  }
  for (const file of files) {
    const rel = path.relative(ROOT, file).split(path.sep).join("/");
    const source = fs.readFileSync(file, "utf8");
    const imports = [...source.matchAll(importRe)].map((m) => m[2]);
    for (const spec of imports) {
      if (spec.startsWith("@/") || spec.startsWith("apps/")) {
        violations.push({ file: rel, reason: `app alias import "${spec}"` });
        continue;
      }
      if (spec.startsWith(".")) {
        const resolved = path.resolve(path.dirname(file), spec);
        const relToPackage = path.relative(abs, resolved);
        if (relToPackage.startsWith("..") || path.isAbsolute(relToPackage)) {
          violations.push({
            file: rel,
            reason: `${pkg.name} relative import escapes the package: "${spec}"`,
          });
        }
        continue;
      }
      if (spec.startsWith("@mms/")) {
        const workspace = spec.split("/").slice(0, 2).join("/");
        if (
          workspace !== pkg.name.split("/").slice(0, 2).join("/") &&
          !pkg.allowed.includes(workspace)
        ) {
          violations.push({
            file: rel,
            reason: `${pkg.name} may not import ${workspace} (allowed: ${pkg.allowed.join(", ")})`,
          });
        }
      }
    }
    if (pkg.name === "@mms/ui") {
      for (const spec of imports) {
        const hit = FORBIDDEN_UI_SPECIFIERS.find((r) => r.pattern.test(spec));
        if (hit)
          violations.push({ file: rel, reason: `@mms/ui forbidden ${hit.reason}: "${spec}"` });
      }
      if (!TEST_FILE.test(file)) {
        for (const api of FORBIDDEN_UI_APIS) {
          if (api.pattern.test(source)) {
            violations.push({ file: rel, reason: `@mms/ui forbidden ${api.reason}` });
          }
        }
      }
    }
  }
}

// A same-name component in @mms/fe-core may be an adapter/facade over @mms/ui, but
// never a fork that re-implements the primitive while ignoring the shared one.
const UI_SRC = path.join(ROOT, "packages/ui/src");
const FE_COMPONENTS_SRC = path.join(ROOT, "packages/fe-core/src/components");
const componentFiles = (dir) =>
  fs.existsSync(dir)
    ? walkFiles(dir).filter(
        (file) =>
          SOURCE.test(file) &&
          !TEST_FILE.test(file) &&
          !file.endsWith(".d.ts") &&
          path.basename(file) !== "index.ts",
      )
    : [];
const uiComponentBasenames = new Set(componentFiles(UI_SRC).map((file) => path.basename(file)));
for (const file of componentFiles(FE_COMPONENTS_SRC)) {
  const basename = path.basename(file);
  if (!uiComponentBasenames.has(basename)) continue;
  if (fs.readFileSync(file, "utf8").includes("@mms/ui")) continue;
  violations.push({
    file: path.relative(ROOT, file).split(path.sep).join("/"),
    reason: `@mms/fe-core component "${basename}" shares a basename with @mms/ui but does not consume it (fork of the shared primitive)`,
  });
}

if (violations.length > 0) {
  console.error(`✗ ${violations.length} core-package boundary violation(s):`);
  for (const v of violations.slice(0, 80)) console.error(`  - ${v.file}: ${v.reason}`);
  if (violations.length > 80) console.error(`  …and ${violations.length - 80} more`);
  process.exit(1);
}

console.log(
  "✓ Core package boundaries held (contracts → leaf; db → contracts; be-core → contracts/db; fe-core → contracts/ui; ui → contracts, no router/API; manifests, relative imports and ui/fe-core forks checked).",
);
