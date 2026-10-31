#!/usr/bin/env node
/**
 * Anti-padding guard for ratchet baselines.
 *
 * The per-script `--ratchet` mode catches a baseline that is HIGHER than the
 * measured count (stale), but not a baseline raised to exactly the new count:
 * add N violations, raise the constant to N, and CI passes. This script compares
 * the BASELINE numeric constants in changed `scripts/check-*.mjs` files between
 * the base ref and HEAD, and fails on any increase.
 *
 * Usage: node scripts/ci/check-ratchet-baselines.mjs --base <ref>
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

/**
 * Extracts numeric BASELINE entries from a script source.
 * Supports `const BASELINE = { key: 1, ... };` and `const BASELINE = 1;`.
 *
 * @param {string} source
 * @returns {Map<string, number>}
 */
export function parseBaselines(source) {
  const out = new Map();

  const object = source.match(/const BASELINE\s*=\s*\{([\s\S]*?)\};/);
  if (object) {
    for (const match of object[1].matchAll(/([A-Za-z_$][\w$]*)\s*:\s*(\d+)/g)) {
      out.set(match[1], Number(match[2]));
    }
  }

  const scalar = source.match(/const BASELINE\s*=\s*(\d+)\s*;/);
  if (scalar) out.set("__scalar__", Number(scalar[1]));

  return out;
}

/**
 * @param {string} baseSource
 * @param {string} headSource
 * @returns {Array<{ key: string, from: number, to: number }>}
 */
export function findIncreasedBaselines(baseSource, headSource) {
  const base = parseBaselines(baseSource);
  const head = parseBaselines(headSource);
  const increased = [];
  for (const [key, value] of head) {
    const previous = base.get(key);
    if (previous !== undefined && value > previous) {
      increased.push({ key, from: previous, to: value });
    }
  }
  return increased;
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function main() {
  const args = process.argv.slice(2);
  const baseIndex = args.indexOf("--base");
  const base = baseIndex >= 0 ? args[baseIndex + 1] : process.env.MMS_CI_BASE || "HEAD^1";

  try {
    git(["rev-parse", "--verify", "--quiet", base]);
  } catch {
    console.error(`::error::cannot resolve base ref "${base}" for the baseline check`);
    process.exitCode = 1;
    return;
  }

  const diffOutput = [
    git(["diff", "--name-only", "--diff-filter=ACMR", `${base}...HEAD`, "--", "scripts"]),
    git(["diff", "--name-only", "--diff-filter=ACMR", "--cached", "--", "scripts"]),
    git(["diff", "--name-only", "--diff-filter=ACMR", "--", "scripts"]),
  ].join("\n");

  const changed = new Set(
    diffOutput
      .split("\n")
      .map((line) => line.trim())
      .filter((file) => /^scripts\/check-[^/]+\.mjs$/.test(file)),
  );

  let failures = 0;
  for (const file of changed) {
    let baseSource;
    try {
      baseSource = git(["show", `${base}:${file}`]);
    } catch {
      continue; // new script — nothing to compare against
    }
    const headSource = fs.readFileSync(path.resolve(file), "utf8");
    for (const increase of findIncreasedBaselines(baseSource, headSource)) {
      console.error(
        `::error::${file}: baseline "${increase.key}" increased ${increase.from} → ${increase.to} (padding is not allowed)`,
      );
      failures += 1;
    }
  }

  if (failures > 0) process.exitCode = 1;
  else
    console.log(`✓ Ratchet baselines did not increase (${changed.size} changed check script(s)).`);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main();
}
