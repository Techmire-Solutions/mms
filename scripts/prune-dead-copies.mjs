#!/usr/bin/env node
// Safe pruner for dead duplicate copies.
//
// History this encodes: two manual prune attempts went wrong (P14: a cascade deleted live files;
// round 46: ten files a test still imported, then `src/test/setup.ts`, invisible to the import graph,
// took the whole platform suite down). The rules that survived are mechanical, so they live here:
//
//   * dead        — unreachable from the app entry AND from every test (`analyseApp().dead`);
//   * identical   — byte-identical (sha1) to a twin elsewhere in the repo, checked at delete time;
//   * not support — never `src/test/**`, a `.d.ts`, or anything a `*.config.*` names by path;
//   * quiet app   — refuses an app whose own sources moved in the last 15 minutes (P12c); a moving\n//                   module elsewhere is harmless because twin drift fails the sha compare;
//   * dry run     — the default. Nothing is deleted without `--apply`.
//
// After `--apply` the caller must run typecheck + the app's suite; the script prints the exact commands.
//
// Usage:
//   node scripts/prune-dead-copies.mjs                 # dry run, both apps
//   node scripts/prune-dead-copies.mjs --apply         # delete (asks for a quiet tree)
//   node scripts/prune-dead-copies.mjs --app platform-web --apply --force

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { ROOT } from "./lib/repo-paths.mjs";
import { analyseApp, recentlyModified } from "./report-dead-sources.mjs";

const APPS = ["tenant-web", "platform-web"];
const SUPPORT = /(?:^|\/)src\/test\/|\.d\.ts$/;

function sha1(file) {
  return crypto.createHash("sha1").update(fs.readFileSync(file)).digest("hex");
}

/**
 * Decide what may be deleted. Pure apart from the filesystem reads it performs on the candidates, so
 * the rules are testable with a fixture app directory.
 */
export function selectPrunable({ apps = APPS, repoRoot = ROOT, requireTwin = true } = {}) {
  const prunable = [];
  const skipped = [];
  for (const app of apps) {
    const appDir = path.join(repoRoot, "apps", app);
    if (!fs.existsSync(path.join(appDir, "src", "main.tsx"))) continue;
    const report = analyseApp(appDir, { repoRoot, duplicates: true });
    for (const entry of report.duplicates?.copied ?? []) {
      const rel = path.relative(repoRoot, entry.file);
      if (!entry.dead) {
        skipped.push({ file: rel, reason: "reachable from a test" });
        continue;
      }
      if (SUPPORT.test(entry.file)) {
        skipped.push({ file: rel, reason: "config-referenced or declaration file" });
        continue;
      }
      if (!fs.existsSync(entry.file) || !fs.existsSync(entry.twin)) {
        skipped.push({ file: rel, reason: "candidate or twin disappeared" });
        continue;
      }
      if (requireTwin && sha1(entry.file) !== sha1(entry.twin)) {
        skipped.push({ file: rel, reason: "content drifted from its twin" });
        continue;
      }
      prunable.push({
        app,
        file: rel,
        absolute: entry.file,
        twin: path.relative(repoRoot, entry.twin),
      });
    }
  }
  return { prunable, skipped };
}

/**
 * Split the selected apps into quiet and busy by their own `src` churn. Exported so the rule is
 * testable: per-app rather than repo-wide, because a dead verdict for an app only depends on that
 * app's sources and tests, and twin drift is caught by the sha compare at delete time.
 */
export function chooseQuietApps(
  apps,
  { repoRoot = ROOT, minutes = 15, measure = recentlyModified } = {},
) {
  const quiet = [];
  const busy = [];
  for (const app of apps) {
    const recent = measure([`apps/${app}/src`], { repoRoot, minutes });
    (recent > 0 ? busy : quiet).push({ app, recent });
  }
  return { quiet, busy };
}

function main() {
  const argv = process.argv.slice(2);
  const apply = argv.includes("--apply");
  const force = argv.includes("--force");
  const appIndex = argv.indexOf("--app");
  const apps = appIndex >= 0 ? [argv[appIndex + 1]] : APPS;

  // Quiescence is measured per app, not repo-wide: `dead` for an app depends only on that app's own
  // sources and tests, and a twin that drifts while a module is being rewritten is caught by the sha
  // compare at delete time (a mismatch is skipped, never deleted). Demanding a globally quiet monorepo
  // would mean the pruner almost never runs during an extraction, which is exactly when the dead
  // copies accumulate.
  const { quiet, busy } = chooseQuietApps(apps, { repoRoot: ROOT, minutes: 15 });
  for (const { app, recent } of busy) {
    console.error(
      `✗ apps/${app}/src: ${recent} file(s) changed in the last 15 minutes — "dead" cannot be trusted there (P12c).`,
    );
  }
  const targets = force ? apps : quiet.map((entry) => entry.app);
  if (targets.length === 0) {
    console.error(
      "Nothing to do: every selected app is active. Wait, or pass --force if the churn is unrelated.",
    );
    process.exit(2);
  }

  const { prunable, skipped } = selectPrunable({ apps: targets, repoRoot: ROOT });

  console.log(`dead duplicate copies: ${prunable.length}`);
  for (const item of prunable) console.log(`  ${item.file}\n      ← twin ${item.twin}`);
  if (skipped.length > 0) {
    console.log(`\nleft alone (${skipped.length}):`);
    for (const item of skipped) console.log(`  ${item.file} — ${item.reason}`);
  }

  if (!apply) {
    console.log(
      "\ndry run — nothing deleted. Re-run with --apply (and a quiet tree) to remove them.",
    );
    return;
  }

  let deleted = 0;
  for (const item of prunable) {
    // Re-verify immediately before each unlink: the report may be minutes old.
    if (!fs.existsSync(item.absolute) || !fs.existsSync(path.join(ROOT, item.twin))) continue;
    if (sha1(item.absolute) !== sha1(path.join(ROOT, item.twin))) continue;
    fs.unlinkSync(item.absolute);
    deleted += 1;
  }
  console.log(`\ndeleted ${deleted} of ${prunable.length}.`);
  console.log("Now prove it: pnpm --filter mms-<app> typecheck && pnpm --filter mms-<app> test");
}

if (import.meta.url === `file://${process.argv[1]}`) main();
