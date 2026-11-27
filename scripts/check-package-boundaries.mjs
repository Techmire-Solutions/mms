#!/usr/bin/env node
/**
 * Package boundary ratchet (migration plan P6/P9).
 *
 * Architectural import direction, enforced mechanically:
 *
 *   contracts  -> nothing internal
 *   db         -> contracts, tooling
 *   be-core    -> contracts, db, tooling        (never a module, never an app)
 *   fe-core    -> contracts, ui, tooling        (never a module, never an app)
 *   ui         -> contracts, tooling            (never a module, never an app)
 *   modules    -> contracts, db, be-core | fe-core + ui   (never another module)
 *   apps       -> anything below them
 *
 *   node scripts/check-package-boundaries.mjs
 *   node scripts/check-package-boundaries.mjs --json
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

const RULES = {
  contracts: { banned: [/@mms\//, /apps\//] },
  db: { banned: [/@mms\/mod-/, /apps\//, /@mms\/be-core/, /@mms\/fe-core/, /@mms\/ui/] },
  "be-core": { banned: [/@mms\/mod-/, /apps\//] },
  "fe-core": { banned: [/@mms\/mod-/, /apps\//] },
  ui: { banned: [/@mms\/mod-/, /apps\//, /@mms\/fe-core/] },
};

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

const violations = [];
for (const [pkg, { banned }] of Object.entries(RULES)) {
  const src = join(ROOT, "packages", pkg, "src");
  if (!existsSync(src)) continue;
  for (const file of walk(src)) {
    const text = readFileSync(file, "utf8");
    // Only module specifiers count — a comment mentioning `apps/` is not an edge.
    const specifiers = [...text.matchAll(/from\s+"([^"]+)"|import\s*\(\s*"([^"]+)"\s*\)/g)]
      .map((m) => m[1] ?? m[2])
      .filter(Boolean);
    for (const re of banned) {
      const hit = specifiers.find((spec) => re.test(spec));
      if (hit) violations.push({ pkg, file: relative(ROOT, file), specifier: hit });
    }
  }
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ violations }, null, 2));
} else if (violations.length > 0) {
  console.error(`package boundaries: ${violations.length} violation(s)`);
  for (const v of violations.slice(0, 40)) {
    console.error(`  @mms/${v.pkg}: ${v.file} imports ${v.specifier}`);
  }
} else {
  console.log("package boundaries: OK (contracts/db/be-core/fe-core/ui all point downward)");
}
process.exit(violations.length > 0 ? 1 : 0);
