#!/usr/bin/env node
// One command that answers "is this checkout green?".
//
// Every round of this migration has been verified with an ad-hoc bash loop: per-app typechecks, the 43
// `check:*`/`verify:*` gates, both Vitest suites, the scripts' own tests, docs. Those loops were spelled
// differently each time, so results were hard to compare and the slow steps got skipped under time
// pressure. This script fixes the order and the reporting:
//
//   typecheck (both apps) -> gates (package.json check:*/verify:*) -> suites (both apps)
//   -> script tests -> docs
//
// A failing step does not abort the run: later steps still report, so one round of output shows every
// problem instead of the first. Exit code is 1 if anything failed.
//
// Usage:
//   node scripts/verify-all.mjs                 # everything
//   node scripts/verify-all.mjs --skip-suites   # fast loop (typecheck + gates + scripts tests)
//   node scripts/verify-all.mjs --json          # machine-readable summary

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { ROOT } from "./lib/repo-paths.mjs";

const APPS = [
  { filter: "mms-tenant-web", label: "apps/tenant-web" },
  { filter: "mms-platform-web", label: "apps/platform-web" },
];

/** First meaningful line of a failed command's output, for the summary table. */
function firstFailureLine(output) {
  const lines = output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const errorLine = lines.find((line) => /error TS|✗|❌|✖|Error:|failed|FAIL/.test(line));
  return (errorLine ?? lines.at(-1) ?? "").slice(0, 160);
}

function run(label, argv, { env = {} } = {}) {
  const started = Date.now();
  try {
    const output = execFileSync(argv[0], argv.slice(1), {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, CI: "1", ...env },
      maxBuffer: 64 * 1024 * 1024,
    });
    return { label, ok: true, ms: Date.now() - started, detail: "", output };
  } catch (error) {
    const stdout = typeof error.stdout === "string" ? error.stdout : "";
    const stderr = typeof error.stderr === "string" ? error.stderr : "";
    const combined = `${stdout}\n${stderr}`;
    return {
      label,
      ok: false,
      ms: Date.now() - started,
      detail: firstFailureLine(combined),
      output: combined,
    };
  }
}

/**
 * Flags CI adds when it invokes a gate, **read from the workflow** rather than kept in a map here.
 * Running the plain package script while CI runs `--ratchet` silently diverges: `check:code-norms
 * --ratchet` fails on a raised baseline that plain mode accepts (round 44). Deriving them means the two
 * cannot drift apart — editing ci.yml is enough.
 */
export function ciFlagsFrom(workflowPath = path.join(ROOT, ".github", "workflows", "ci.yml")) {
  const flags = new Map();
  if (!fs.existsSync(workflowPath)) return flags;
  for (const match of fs
    .readFileSync(workflowPath, "utf8")
    .matchAll(/node\s+(scripts\/[\w.-]+\.mjs)((?:\s+--[\w-]+)*)/g)) {
    const [, script, rawFlags] = match;
    const parsed = rawFlags.trim().split(/\s+/).filter(Boolean);
    if (parsed.length === 0) continue;
    const existing = flags.get(script) ?? [];
    flags.set(script, [...new Set([...existing, ...parsed])]);
  }
  return flags;
}

/** The `scripts/…` path a package script runs, if any. */
function scriptPathOf(command) {
  return (command.match(/node\s+(scripts\/[^\s]+)/) ?? [])[1] ?? null;
}

function gateCommands() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  return Object.entries(manifest.scripts ?? {})
    .filter(([name]) => /^check:|^verify:/.test(name))
    .filter(([name]) => name !== "verify:all") // never recurse into this runner
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, command]) => ({ name, command }));
}

/**
 * Run a package script's command directly instead of through `pnpm run`.
 * `pnpm run` costs ~40-70s per invocation on this repo (it re-validates the lockfile and store), which
 * turned a 44-gate sweep into a 40-minute run. Shell-free argv keeps it deterministic.
 */
function argvFor(command) {
  if (/^node\s/.test(command)) return ["node", ...splitArgs(command.replace(/^node\s+/, ""))];
  if (/^bash\s/.test(command)) return ["bash", ...splitArgs(command.replace(/^bash\s+/, ""))];
  return null;
}

/** Minimal argv split honouring single/double quotes; these commands have no shell expansions. */
function splitArgs(text) {
  const out = [];
  const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;
  for (const match of text.matchAll(pattern)) out.push(match[1] ?? match[2] ?? match[3]);
  return out;
}

function main() {
  const argv = process.argv.slice(2);
  const json = argv.includes("--json");
  const skipSuites = argv.includes("--skip-suites");
  const skipGates = argv.includes("--skip-gates");

  const steps = [];

  for (const app of APPS) {
    if (fs.existsSync(path.join(ROOT, app.label))) {
      steps.push(run(`typecheck ${app.label}`, ["pnpm", "--filter", app.filter, "typecheck"]));
    }
  }

  if (!skipGates) {
    const ciFlags = ciFlagsFrom();
    for (const { name, command } of gateCommands()) {
      const extra = ciFlags.get(scriptPathOf(command)) ?? [];
      const argv = argvFor(command);
      if (!argv) {
        steps.push(
          run(name, ["pnpm", "run", "-s", name, ...(extra.length ? ["--", ...extra] : [])]),
        );
        continue;
      }
      steps.push(run(`${name}${extra.length ? ` ${extra.join(" ")}` : ""}`, [...argv, ...extra]));
    }
  }

  if (!skipSuites) {
    for (const app of APPS) {
      if (fs.existsSync(path.join(ROOT, app.label))) {
        steps.push(run(`suite ${app.label}`, ["pnpm", "--filter", app.filter, "test"]));
      }
    }
  }

  steps.push(run("scripts tests", ["pnpm", "run", "test:scripts"]));

  const failed = steps.filter((step) => !step.ok);
  if (json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: failed.length === 0,
          total: steps.length,
          failed: failed.map(({ label, detail }) => ({ label, detail })),
          steps: steps.map(({ label, ok, ms, detail }) => ({ label, ok, ms, detail })),
        },
        null,
        2,
      )}\n`,
    );
  } else {
    for (const step of steps) {
      const mark = step.ok ? "✓" : "✗";
      console.log(
        `${mark} ${step.label.padEnd(42)} ${String(step.ms).padStart(6)}ms${step.ok ? "" : `  ${step.detail}`}`,
      );
    }
    console.log("");
    if (failed.length === 0) {
      console.log(`✨ all ${steps.length} verification steps passed`);
    } else {
      console.log(`💥 ${failed.length} of ${steps.length} verification steps failed`);
      for (const step of failed) console.log(`   ✗ ${step.label}: ${step.detail}`);
    }
  }

  process.exitCode = failed.length === 0 ? 0 : 1;
}

// Guarded so the module can be imported by tests: an unguarded `main()` here made importing it run the
// whole 48-step verification (1 h 47 m inside a unit test — round 59 found it the hard way).
if (import.meta.url === `file://${process.argv[1]}`) main();
