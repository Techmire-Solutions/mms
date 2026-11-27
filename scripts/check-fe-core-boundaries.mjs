#!/usr/bin/env node
/**
 * fe-core boundary ratchet (migration plan P6/P9).
 *
 * `@mms/fe-core` is the shared frontend kernel: it may depend on
 * `@mms/contracts`, `@mms/ui` and `tooling` only. It must never import a module
 * (`@mms/mod-*`) or an app (`apps/*`), and its layer split must stay honest:
 *
 *   node scripts/check-fe-core-boundaries.mjs
 *   node scripts/check-fe-core-boundaries.mjs --json
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const SRC = join(ROOT, "packages/fe-core/src");

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === "dist") continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

const BANNED = [/@mms\/mod-/, /apps\//];
const violations = [];

if (existsSync(SRC)) {
  for (const file of walk(SRC)) {
    const text = readFileSync(file, "utf8");
    const rel = relative(ROOT, file);
    const specifiers = [...text.matchAll(/from\s+"([^"]+)"|import\s*\(\s*"([^"]+)"\s*\)/g)]
      .map((m) => m[1] ?? m[2])
      .filter(Boolean);
    for (const re of BANNED) {
      const hit = specifiers.find((s) => re.test(s));
      if (hit) violations.push({ file: rel, specifier: hit });
    }
  }
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ violations }, null, 2));
} else if (violations.length > 0) {
  console.error(`fe-core boundaries: ${violations.length} violation(s)`);
  for (const v of violations.slice(0, 40)) console.error(`  ${v.file} imports ${v.specifier}`);
} else {
  console.log("fe-core boundaries: OK (no module or app imports)");
}
process.exit(violations.length > 0 ? 1 : 0);
