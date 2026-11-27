#!/usr/bin/env node
/**
 * Web-app isolation ratchet (migration plan P8/P9).
 *
 * Enforces that the two web apps are independent shells:
 *   - `apps/tenant-web` must not import from `apps/platform-web` (and vice versa);
 *   - neither app may import a module barrel outside its audience
 *     (`@mms/mod-<m>/frontend/<other-audience>`).
 *
 *   node scripts/check-web-app-isolation.mjs
 *   node scripts/check-web-app-isolation.mjs --json
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const APPS = {
  tenant: join(ROOT, "apps/tenant-web/src"),
  platform: join(ROOT, "apps/platform-web/src"),
};

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

const violations = [];
for (const [app, dir] of Object.entries(APPS)) {
  const other = app === "tenant" ? "platform" : "tenant";
  for (const file of walk(dir)) {
    const source = readFileSync(file, "utf8");
    const rel = relative(ROOT, file);
    const specifiers = [...source.matchAll(/from\s+"([^"]+)"|import\s*\(\s*"([^"]+)"\s*\)/g)]
      .map((m) => m[1] ?? m[2])
      .filter(Boolean);
    const appRef = specifiers.find((spec) => spec.includes(`apps/${other}-web`));
    if (appRef) {
      violations.push({ app, file: rel, rule: `imports apps/${other}-web` });
    }
    const expected = app === "tenant" ? "tenant" : "platform";
    const SHARED = ["components", "shared", "lib", "hooks", "host", "test"];
    for (const spec of specifiers) {
      const m = spec.match(/@mms\/mod-[a-z0-9-]+\/frontend\/([a-z-]+)/);
      if (!m) continue;
      const audience = m[1];
      if (audience === expected || SHARED.includes(audience)) continue;
      violations.push({ app, file: rel, rule: `cross-audience import ${spec}` });
    }
  }
}

import { existsSync, writeFileSync } from "node:fs";

const BASELINE = join(ROOT, "scripts/web-app-isolation-baseline.json");
const keys = violations.map((v) => `${v.app}:${v.file}:${v.rule}`).sort();

if (process.argv.includes("--freeze")) {
  writeFileSync(BASELINE, JSON.stringify({ frozen: keys }, null, 2) + "\n");
  console.log(`web-app isolation: froze ${keys.length} baseline violation(s)`);
  process.exit(0);
}

const frozen = existsSync(BASELINE)
  ? new Set(JSON.parse(readFileSync(BASELINE, "utf8")).frozen ?? [])
  : new Set();
const fresh = keys.filter((k) => !frozen.has(k));
const resolved = [...frozen].filter((k) => !keys.includes(k));

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ fresh, resolved, total: keys.length }, null, 2));
} else if (fresh.length > 0) {
  console.error(`web-app isolation: ${fresh.length} NEW violation(s) (baseline ${frozen.size})`);
  for (const k of fresh) console.error(`  ${k}`);
  if (resolved.length > 0) console.error(`  resolved since baseline: ${resolved.length}`);
} else {
  console.log(`web-app isolation: OK (baseline ${frozen.size}, no new violations)`);
}
process.exit(fresh.length > 0 ? 1 : 0);
