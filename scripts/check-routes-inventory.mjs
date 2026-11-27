#!/usr/bin/env node
/**
 * Routes inventory ratchet (migration plan P7/P9).
 *
 * Every module package that ships a backend tenant/platform router must be
 * mounted by the API composition root — otherwise its routes silently vanish
 * from the running server while the package still builds.
 *
 *   node scripts/check-routes-inventory.mjs
 *   node scripts/check-routes-inventory.mjs --json
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const MODULES = join(ROOT, "packages/modules");
const ROUTES = join(ROOT, "apps/api/src/routes/index.ts");

const source = existsSync(ROUTES) ? readFileSync(ROUTES, "utf8") : "";
const modules = readdirSync(MODULES, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

const missing = [];
const mounted = [];
for (const name of modules) {
  const pkg = join(MODULES, name, "package.json");
  if (!existsSync(pkg)) continue;
  const exportsMap = JSON.parse(readFileSync(pkg, "utf8")).exports ?? {};
  const audiences = Object.keys(exportsMap).filter(
    (k) => k.endsWith("/backend/tenant") || k.endsWith("/backend/platform"),
  );
  if (audiences.length === 0) continue;
  const referenced = source.includes(`@mms/mod-${name}/`);
  if (referenced) mounted.push(name);
  else missing.push({ module: `@mms/mod-${name}`, audiences });
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ mounted, missing }, null, 2));
} else if (missing.length > 0) {
  console.error(
    `routes inventory: ${missing.length} module(s) not mounted by apps/api/src/routes/index.ts`,
  );
  for (const m of missing) console.error(`  ${m.module} (${m.audiences.join(", ")})`);
} else {
  console.log(`routes inventory: OK (${mounted.length} module(s) mounted)`);
}
process.exit(missing.length > 0 ? 1 : 0);
