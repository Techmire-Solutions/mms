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
    if (source.includes(`apps/${other}-web`)) {
      violations.push({ app, file: rel, rule: `imports apps/${other}-web` });
    }
    const crossAudience = new RegExp(
      `@mms/mod-[a-z0-9-]+/frontend/(?!${other === "tenant" ? "platform" : "tenant"}\\b)`,
      "g",
    );
    for (const match of source.matchAll(crossAudience)) {
      // A tenant app importing a platform barrel (or the reverse) is a violation.
      const expected = app === "tenant" ? "tenant" : "platform";
      if (!match[0].endsWith(`/${expected}`)) {
        violations.push({ app, file: rel, rule: `cross-audience import ${match[0]}` });
      }
    }
  }
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ violations }, null, 2));
} else if (violations.length > 0) {
  console.error(`web-app isolation: ${violations.length} violation(s)`);
  for (const v of violations) console.error(`  ${v.file} — ${v.rule}`);
} else {
  console.log("web-app isolation: OK (neither app imports the other)");
}
process.exit(violations.length > 0 ? 1 : 0);
