#!/usr/bin/env node
/**
 * Fails when a staged canonical rule/skill/workflow is committed without its
 * generated mirrors staged alongside it (`mms-core` "Standards Mirroring").
 *
 *   node scripts/check-standards-staged.mjs
 *
 * Canonical → mirrors:
 *   .cursor/rules/<rule>.mdc   → .agent/rules, .claude/rules, .dsh/rules
 *   .cursor/rules/README.md    → .agent/rules/README.md, .claude/rules/README.md, .dsh/rules/README.md
 *   .agent/skills/<path>       → .cursor/skills, .claude/skills, .dsh/skills
 *   .agent/workflows/<file>    → .claude/docs/workflows/<file>
 * AGENTS.md / CLAUDE.md are entry points, not mirrored.
 *
 * Run `bash .agent/scripts/sync-all.sh` first; this script only checks staging.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const git = (args) => {
  try {
    return execFileSync("git", args, { encoding: "utf8" })
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
};

const staged = new Set(git(["diff", "--cached", "--name-only", "--diff-filter=ACMR"]));

const mirrorsFor = (file) => {
  if (file === ".cursor/rules/README.md") {
    return [".agent/rules/README.md", ".claude/rules/README.md", ".dsh/rules/README.md"];
  }
  if (file.startsWith(".cursor/rules/") && file.endsWith(".mdc")) {
    const base = `${file.slice(".cursor/rules/".length, -4)}.md`;
    return [`.agent/rules/${base}`, `.claude/rules/${base}`, `.dsh/rules/${base}`];
  }
  if (file.startsWith(".agent/skills/")) {
    const rel = file.slice(".agent/skills/".length);
    // .dsh/skills intentionally excludes README.md (a flat .md would be parsed by DSH as a broken skill)
    if (rel === "README.md") {
      return [`.cursor/skills/${rel}`, `.claude/skills/${rel}`];
    }
    return [`.cursor/skills/${rel}`, `.claude/skills/${rel}`, `.dsh/skills/${rel}`];
  }
  if (file.startsWith(".agent/workflows/")) {
    const rel = file.slice(".agent/workflows/".length);
    return [`.claude/docs/workflows/${rel}`];
  }
  return [];
};

const missing = [];
for (const file of staged) {
  for (const mirror of mirrorsFor(file)) {
    if (!staged.has(mirror)) missing.push(`${mirror}  (mirror of ${file})`);
    else if (!fs.existsSync(mirror)) missing.push(`${mirror}  (missing on disk — run sync-all.sh)`);
  }
}

if (missing.length > 0) {
  console.error("❌ Standards mirrors are not staged with their canonical source:");
  for (const line of missing) console.error(`   - ${line}`);
  console.error("   Run 'bash .agent/scripts/sync-all.sh', stage the mirrors, and commit again.");
  process.exit(1);
}

console.log(
  `✓ Standards mirrors staged alongside their sources (${staged.size} staged paths checked).`,
);
