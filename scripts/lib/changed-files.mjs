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

/** File content at the change base, or null when the file is new. */
export function readAtBase(rel) {
  return git(["show", `${changeBase}:${rel}`]);
}
