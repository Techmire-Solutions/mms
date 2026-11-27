#!/usr/bin/env node
// Gate: every `check:*` / `verify:*` script is actually run somewhere in CI.
//
// Why this exists: a gate that nothing invokes is documentation, not enforcement. Round 37 found
// `check:fe-core-boundaries` — a real "fe-core imports no module or app" invariant — living in
// package.json with no workflow step at all, so it had never run in CI.
//
// Coverage model: a gate counts as wired when a workflow or `scripts/ci/local-ci.sh` mentions either the
// package-script name (`pnpm run check:x`, `pnpm -s check:x`) or the script path from its command
// (`node scripts/check-x.mjs`). Anything else must be listed in ADVISORY with a reason and a citation.
//
// Usage: node scripts/check-ci-gate-parity.mjs [--json]

import fs from "node:fs";
import path from "node:path";

import { ROOT, EmptyScanError } from "./lib/repo-paths.mjs";

const WORKFLOW_DIR = path.join(ROOT, ".github", "workflows");
const LOCAL_CI = path.join(ROOT, "scripts", "ci", "local-ci.sh");
const PACKAGE_JSON = path.join(ROOT, "package.json");

/** Deliberately not CI-blocking. Each entry needs the reason and where the policy is written. */
export const ADVISORY = new Map([
  [
    "check:tdd-pairing",
    "advisory by policy — AGENTS.md ('advisory pairing check pnpm run check:tdd-pairing'); it reports backend domain files without a paired spec and must not block a merge",
  ],
  [
    "verify:all",
    "developer entry point, not a CI gate — it runs the typechecks, every gate, both suites and the script tests itself; CI invokes those steps individually so a failure is attributed to one job",
  ],
]);

/** Every gate script declared in package.json, as { name, command, scriptPath }. */
export function readGates(manifestPath = PACKAGE_JSON) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  return Object.entries(manifest.scripts ?? {})
    .filter(([name]) => /^check:|^verify:/.test(name))
    .map(([name, command]) => ({
      name,
      command,
      scriptPath: (command.match(/node\s+(scripts\/[^\s]+)/) ?? [])[1] ?? null,
    }));
}

/** Concatenated text of everything that can invoke a gate. */
export function readInvocations(workflowDir = WORKFLOW_DIR, localCi = LOCAL_CI) {
  const parts = [];
  if (fs.existsSync(workflowDir)) {
    for (const file of fs.readdirSync(workflowDir)) {
      if (!/\.ya?ml$/.test(file)) continue;
      parts.push(fs.readFileSync(path.join(workflowDir, file), "utf8"));
    }
  }
  if (fs.existsSync(localCi)) parts.push(fs.readFileSync(localCi, "utf8"));
  const text = parts.join("\n");
  if (text.trim().length === 0) {
    throw new EmptyScanError("check-ci-gate-parity", `${workflowDir}, ${localCi}`);
  }
  return text;
}

function mentionsGate(haystack, gate) {
  const escaped = gate.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const byName = new RegExp(`pnpm\\s+(?:run\\s+)?-?s?\\s*${escaped}(?![\\w:-])`).test(haystack);
  const byPath = gate.scriptPath ? haystack.includes(gate.scriptPath) : false;
  return byName || byPath;
}

export function findUnwired(gates, haystack, advisory = ADVISORY) {
  const unwired = [];
  for (const gate of gates) {
    if (advisory.has(gate.name)) continue;
    if (!mentionsGate(haystack, gate)) unwired.push(gate.name);
  }
  // A stale allowlist entry is its own bug: it claims an exemption for a gate that no longer exists.
  const names = new Set(gates.map((gate) => gate.name));
  const stale = [...advisory.keys()].filter((name) => !names.has(name));
  return { unwired: unwired.sort(), stale: stale.sort() };
}

function main() {
  const json = process.argv.includes("--json");
  const gates = readGates();
  const haystack = readInvocations();
  const { unwired, stale } = findUnwired(gates, haystack);

  if (json) {
    process.stdout.write(`${JSON.stringify({ gates: gates.length, unwired, stale }, null, 2)}\n`);
  } else if (unwired.length === 0 && stale.length === 0) {
    const advisoryCount = gates.filter((gate) => ADVISORY.has(gate.name)).length;
    console.log(
      `✓ every gate is invoked by CI (${gates.length - advisoryCount} wired, ${advisoryCount} advisory)`,
    );
  } else {
    for (const name of unwired) {
      console.error(
        `✗ ${name} is declared in package.json but no workflow or local-ci step runs it`,
      );
    }
    for (const name of stale) {
      console.error(`✗ ADVISORY lists ${name}, which is no longer a package script`);
    }
    console.error(
      "\nFix: add a CI step (or a local-ci bucket) for the gate, or list it in ADVISORY with the reason and\n" +
        "the policy that makes it advisory.",
    );
  }
  process.exitCode = unwired.length === 0 && stale.length === 0 ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (error) {
    if (error instanceof EmptyScanError) {
      console.error(`✗ ${error.message}`);
      process.exitCode = 1;
    } else {
      throw error;
    }
  }
}
