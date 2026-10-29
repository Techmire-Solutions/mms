#!/usr/bin/env bash
# Sync .agent/skills/ → .cursor/skills/ (canonical Antigravity → Cursor).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done
export MMS_SYNC_DRY_RUN="$DRY_RUN"

# `node -` forces script mode: a bare `node <<` starts the REPL under Git Bash on Windows.
node - <<'SCRIPT'
const fs = require("fs");
const path = require("path");

const DRY = process.env.MMS_SYNC_DRY_RUN === "1";
const src = ".agent/skills";
const dest = ".cursor/skills";

// Helper to translate rule references from .md to .mdc.
// Only rule names are rewritten, and only as `rules/<name>.md` or a bare
// `<name>.md`. Path-qualified files such as `.claude/agents/mms-docs-auditor.md`
// must NOT be rewritten — the old blanket regex turned them into non-existent
// `.mdc` paths inside the Cursor mirror.
function translateRuleRefs(content) {
  const names = "mms-[a-z0-9-]+|antigravity-global|saas-architecture";
  return content
    .replace(new RegExp(`(?<![\\w/.-])(rules\\/(?:${names}))\\.md\\b`, "g"), "$1.mdc")
    .replace(new RegExp(`(?<![\\w/.-])(?:${names})\\.md\\b`, "g"), (match) => `${match.slice(0, -3)}.mdc`);
}

// Prune orphaned skill directories in dest
const srcSkills = new Set(
  fs.readdirSync(src, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
);

if (fs.existsSync(dest)) {
  for (const entry of fs.readdirSync(dest, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const name = entry.name;
      if (!srcSkills.has(name)) {
        if (!DRY) fs.rmSync(path.join(dest, name), { recursive: true, force: true });
        console.log(`${DRY ? "would prune" : "pruned"} orphaned skill: ${name}`);
      }
    }
  }
}

for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
  if (entry.isDirectory()) {
    const name = entry.name;
    const srcDir = path.join(src, name);
    const destDir = path.join(dest, name);
    if (!DRY) fs.mkdirSync(destDir, { recursive: true });

    const skillFile = path.join(srcDir, "SKILL.md");
    if (fs.existsSync(skillFile)) {
      const content = fs.readFileSync(skillFile, "utf8");
      const updated = translateRuleRefs(content);
      if (!DRY) fs.writeFileSync(path.join(destDir, "SKILL.md"), updated, "utf8");
      console.log(`synced skill ${name}`);
    }

    const subdirs = ["scripts", "references", "examples", "data"];
    for (const sub of subdirs) {
      const subDir = path.join(srcDir, sub);
      if (fs.existsSync(subDir) && fs.statSync(subDir).isDirectory()) {
        const destSubDir = path.join(destDir, sub);
        if (!DRY) {
          fs.mkdirSync(destSubDir, { recursive: true });
          fs.cpSync(subDir, destSubDir, { recursive: true });
        }
        console.log(`synced ${sub} ${name}`);
      }
    }
  }
}

const readmeFile = path.join(src, "README.md");
if (fs.existsSync(readmeFile)) {
  const content = fs.readFileSync(readmeFile, "utf8");
  const updated = translateRuleRefs(content);
  if (!DRY) fs.writeFileSync(path.join(dest, "README.md"), updated, "utf8");
}
SCRIPT

echo "Done. Skills mirrored to .cursor/skills"
