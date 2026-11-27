#!/usr/bin/env node
// Ratchet: a gate's detection logic must be pinned by a test.
//
// 37 of the 46 gates in this repo had no test at all — every rule they enforce was only proven by "the tree
// currently happens to satisfy it". That is how a gate silently stops detecting: rename a directory, change a
// regex, and it keeps reporting ✓ while checking nothing.
//
// The repository cannot rewrite 37 gates in one round, so this is a **monotonic ratchet**:
//   * a gate with no matching `scripts/ci/*.test.mjs` must be listed in BASELINE_UNTESTED;
//   * that list may only shrink — a gate that gains a test must be removed from it (the gate fails otherwise);
//   * a gate that is neither tested nor listed fails, so **every new gate needs a test**.
//
// Matching is by script basename with a `check-`/`verify-` prefix stripped, plus a containment check so
// `check-pwa-precache` is satisfied by `pwa-precache-budget.test.mjs`.
//
// Usage: node scripts/check-gate-test-coverage.mjs [--json]

import fs from "node:fs";
import path from "node:path";

import { ROOT } from "./lib/repo-paths.mjs";

const CI_TESTS_DIR = path.join(ROOT, "scripts", "ci");

/**
 * Gates that ship without a test today (measured 2026-11-27). Sorted, and only allowed to shrink.
 * `check:ratchet-baselines` refuses any baseline increase, so removing an entry is the only edit.
 */
export const BASELINE_UNTESTED = Object.freeze([
  "check:accounting-coverage",
  "check:accounting-route-injection",
  "check:accounting-route-security",
  "check:backend-boundaries",
  "check:backend-structure",
  "check:bundle",
  "check:code-norms",
  "check:contracts",
  "check:core-packages",
  "check:db-projections",
  "check:examinations-route-injection",
  "check:examinations-route-security",
  "check:examinations-tests",
  "check:faculty-domain",
  "check:fe-core-boundaries",
  "check:forms",
  "check:frontend-structure",
  "check:i18n",
  "check:i18n-unused",
  "check:migration-hygiene",
  "check:migration-indexes",
  "check:migrations-forward-only",
  "check:module-boundaries",
  "check:money-safety",
  "check:obligations-route-injection",
  "check:obligations-tests",
  "check:package-boundaries",
  "check:ratchet-baselines",
  "check:routes-inventory",
  "check:secrets",
  "check:shared-purity",
  "check:shared-structure",
  "check:shared-ui",
  "check:tdd-pairing",
  "check:web-app-isolation",
  "check:work-directory",
  "verify:rules",
]);

/** Test basenames available under scripts/ci (`foo.test.mjs` -> `foo`). */
export function testBasenames(dir = CI_TESTS_DIR) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".test.mjs"))
    .map((file) => file.replace(/\.test\.mjs$/, ""))
    .sort();
}

/** Does a test exist for this gate script basename? */
export function hasCoveringTest(scriptBase, tests) {
  const bare = scriptBase.replace(/^check-/, "").replace(/^verify-/, "");
  return tests.some(
    (test) =>
      test === scriptBase ||
      test === bare ||
      scriptBase.startsWith(test) ||
      test.startsWith(bare) ||
      test.includes(bare),
  );
}

export function gateScriptBasenames(manifestPath = path.join(ROOT, "package.json")) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const gates = [];
  for (const [name, command] of Object.entries(manifest.scripts ?? {})) {
    if (!/^check:|^verify:/.test(name)) continue;
    const match = command.match(/node\s+(scripts\/[\w.-]+)\.mjs/);
    gates.push({ name, scriptBase: match ? path.basename(match[1], ".mjs") : null });
  }
  return gates.sort((a, b) => a.name.localeCompare(b.name));
}

export function findUncovered(gates, tests, baseline = BASELINE_UNTESTED) {
  const baselineSet = new Set(baseline);
  const failures = [];
  for (const gate of gates) {
    const covered = gate.scriptBase ? hasCoveringTest(gate.scriptBase, tests) : false;
    if (covered) {
      if (baselineSet.has(gate.name)) {
        failures.push(
          `${gate.name} now has a test — remove it from BASELINE_UNTESTED so the list only shrinks`,
        );
      }
      continue;
    }
    if (!baselineSet.has(gate.name)) {
      failures.push(
        `${gate.name} has no test and is not in BASELINE_UNTESTED — add ${gate.scriptBase ?? "<script>"}.test.mjs`,
      );
    }
  }
  return failures;
}

function main() {
  const json = process.argv.includes("--json");
  const gates = gateScriptBasenames();
  const tests = testBasenames();
  const failures = findUncovered(gates, tests);

  if (json) {
    process.stdout.write(
      `${JSON.stringify({ gates: gates.length, tests: tests.length, failures }, null, 2)}\n`,
    );
  } else if (failures.length === 0) {
    const untested = gates.filter(
      (gate) => !gate.scriptBase || !hasCoveringTest(gate.scriptBase, tests),
    ).length;
    console.log(
      `✓ every gate is either tested or a known baseline gap (${gates.length - untested} tested, ${untested} baselined)`,
    );
  } else {
    console.error(`✗ gate test coverage regressed (${failures.length}):`);
    for (const failure of failures) console.error(`    ${failure}`);
    console.error(
      "\nFix: add the test, or — only if the gate is genuinely hard to test — extend the reasoning in the PR.",
    );
  }
  process.exitCode = failures.length === 0 ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) main();
