import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Permanent ratchet for workflow path filters (migration plan P9).
 *
 * Every literal in a `paths:` / `paths-ignore:` list or a dorny/paths-filter
 * `filters:` block must resolve to an existing file or directory (a glob's
 * pre-wildcard root). A directory move that forgets the workflow otherwise
 * makes CI skip a whole job silently.
 */
const WORKFLOWS_DIR = ".github/workflows";

function resolveGlobRoot(pattern) {
  const literal = pattern.trim().replace(/^["']|["']$/g, "");
  if (!literal || literal.startsWith("!") || literal.includes("${{")) return null;
  if (literal === "*" || literal === "**") return null;
  const root = literal.split("*")[0].replace(/\/+$/, "");
  if (!root) return null;
  // Only filesystem-looking entries (not branch names or artifact directory names).
  if (!root.includes("/") && !/\.[A-Za-z0-9]+$/.test(root)) return null;
  return root;
}

function collectFilters(source) {
  const lines = source.split("\n");
  const out = [];
  let inList = false;
  let listIndent = 0;
  for (const line of lines) {
    const key = /^(\s*)(paths|paths-ignore):\s*$/.exec(line);
    if (key) {
      inList = true;
      listIndent = key[1].length;
      continue;
    }
    const filtersBlock = /^(\s*)filters:\s*\|\s*$/.exec(line);
    if (filtersBlock) {
      inList = true;
      listIndent = filtersBlock[1].length;
      continue;
    }
    if (!inList) continue;
    const item = /^(\s*)-\s+(.+?)\s*$/.exec(line);
    if (item && item[1].length > listIndent) {
      out.push(item[2]);
      continue;
    }
    if (line.trim() && !/^\s/.test(line)) inList = false;
    else if (
      line.trim() &&
      /^(\s*)[A-Za-z_][\w-]*:/.test(line) &&
      line.length - line.trimStart().length <= listIndent
    ) {
      inList = false;
    }
  }
  return out;
}

test("every workflow path filter resolves to an existing path", () => {
  const failures = [];
  for (const file of readdirSync(WORKFLOWS_DIR).filter((f) => /\.ya?ml$/.test(f))) {
    const path = join(WORKFLOWS_DIR, file);
    for (const filter of collectFilters(readFileSync(path, "utf8"))) {
      const root = resolveGlobRoot(filter);
      if (!root) continue;
      if (!existsSync(root)) failures.push(`${file}: ${filter} (root: ${root})`);
    }
  }
  assert.deepEqual(failures, []);
});
