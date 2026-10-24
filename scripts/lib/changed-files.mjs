/**
 * Change-set helpers for `--changed` ratchet runs.
 *
 * Reads the set exported by scripts/ci/local-ci.sh (MMS_CI_CHANGED / MMS_CI_BASE);
 * when run standalone, derives it from the merge-base with origin/main (or main).
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";

function git(args) {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return null;
  }
}

function resolveBase() {
  if (process.env.MMS_CI_BASE) return process.env.MMS_CI_BASE;
  for (const ref of ["origin/main", "main"]) {
    const base = git(["merge-base", "HEAD", ref]);
    if (base) return base.trim();
  }
  return "HEAD";
}

export const changeBase = resolveBase();

/**
 * Rename map for the change set: new path -> original path. Without this, a moved
 * file is treated as brand-new in `--changed` mode and every pre-existing violation
 * it carries looks like a regression.
 */
function renameMap() {
  const out = git(["diff", "--name-status", "-M", changeBase]) ?? "";
  const map = new Map();
  for (const line of out.split("\n")) {
    const parts = line.split("\t");
    if (parts[0]?.startsWith("R") && parts.length >= 3) map.set(parts[2].trim(), parts[1].trim());
  }
  return map;
}

const RENAMES = renameMap();

/** Repo-relative paths changed vs the base, including staged and unstaged edits. */
export function changedFiles() {
  const raw = process.env.MMS_CI_CHANGED ?? git(["diff", "--name-only", changeBase]) ?? "";
  return [
    ...new Set(
      raw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    ),
  ];
}

/** Current file content, or null when the file was deleted. */
export function readCurrent(rel) {
  try {
    return fs.readFileSync(rel, "utf8");
  } catch {
    return null;
  }
}

/** File content at the change base (following renames), or null when genuinely new. */
export function readAtBase(rel) {
  const source = RENAMES.get(rel) ?? rel;
  return git(["show", `${changeBase}:${source}`]);
}
