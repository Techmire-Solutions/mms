#!/usr/bin/env bash
# Sync .cursor/rules/*.mdc → .claude/rules/*.md (Claude Code paths frontmatter).
# Sync .agent/skills/ → .claude/skills/
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
const cursorDir = ".cursor/rules";
const claudeRulesDir = ".claude/rules";
const agentsSkillsDir = ".agent/skills";
const claudeSkillsDir = ".claude/skills";

fs.mkdirSync(claudeRulesDir, { recursive: true });

// Prune orphaned rule files in claudeRulesDir
const cursorRules = new Set(
  fs.readdirSync(cursorDir)
    .filter((f) => f.endsWith(".mdc"))
    .map((f) => f.replace(/\.mdc$/, ""))
);

for (const file of fs.readdirSync(claudeRulesDir).filter((f) => f.endsWith(".md") && f !== "README.md")) {
  const base = file.replace(/\.md$/, "");
  if (!cursorRules.has(base)) {
    if (!DRY) fs.unlinkSync(path.join(claudeRulesDir, file));
    console.log(`${DRY ? "would prune" : "pruned"} orphaned claude rule: ${file}`);
  }
}

for (const file of fs.readdirSync(cursorDir).filter((f) => f.endsWith(".mdc"))) {
  const base = file.replace(/\.mdc$/, "");
  const src = fs.readFileSync(path.join(cursorDir, file), "utf8");
  const match = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error(`No frontmatter: ${file}`);
  const front = match[1];
  // Rewrite rule-name references only; keep real .cursor/rules/*.mdc paths intact.
  const body = match[2]
    .replace(/^\s+/, "")
    .replace(/(?<!\.cursor\/rules\/)\b([a-z0-9-]+)\.mdc\b/g, "$1.md");
  const alwaysApply = /alwaysApply:\s*true/.test(front);
  const descMatch = front.match(/^description:\s*(.+)$/m);
  const globsMatch = front.match(/^globs:\s*(.+)$/m);

  const lines = ["---"];
  if (descMatch) lines.push(`description: ${descMatch[1].trim()}`);
  if (!alwaysApply && globsMatch) {
    const rawGlobs = globsMatch[1];
    const paths = [];
    let current = "";
    let braceDepth = 0;
    for (let i = 0; i < rawGlobs.length; i++) {
      const char = rawGlobs[i];
      if (char === "{" || char === "(" || char === "[") braceDepth++;
      else if (char === "}" || char === ")" || char === "]") braceDepth--;
      else if (char === "," && braceDepth === 0) {
        if (current.trim()) paths.push(current.trim());
        current = "";
        continue;
      }
      current += char;
    }
    if (current.trim()) paths.push(current.trim());
    if (paths.length > 0) {
      lines.push("paths:");
      for (const p of paths) lines.push(`  - "${p}"`);
    }
  }
  lines.push("---", "", body);
  const out = lines.join("\n");
  if (!DRY) fs.writeFileSync(path.join(claudeRulesDir, `${base}.md`), out.endsWith("\n") ? out : `${out}\n`);
  console.log(`${DRY ? "would write" : "synced"} rule ${base}.md`);
}
SCRIPT

# Prune orphaned skill directories in .claude/skills
if [[ -d "$ROOT/.claude/skills" ]]; then
  for dir in "$ROOT/.claude/skills"/*/; do
    if [[ -d "$dir" ]]; then
      name="$(basename "$dir")"
      if [[ ! -d "$ROOT/.agent/skills/$name" ]]; then
        [[ "$DRY_RUN" == "1" ]] || rm -rf "$dir"
        echo "pruned orphaned claude skill: $name"
      fi
    fi
  done
fi

for dir in "$ROOT/.agent/skills"/*/; do
  name="$(basename "$dir")"
  [[ "$DRY_RUN" == "1" ]] || mkdir -p "$ROOT/.claude/skills/$name"
  if [[ -f "$dir/SKILL.md" ]]; then
    [[ "$DRY_RUN" == "1" ]] || cp "$dir/SKILL.md" "$ROOT/.claude/skills/$name/SKILL.md"
    echo "synced skill $name"
  fi
  for sub in scripts references examples data; do
    if [[ -d "$dir/$sub" ]]; then
      [[ "$DRY_RUN" == "1" ]] || mkdir -p "$ROOT/.claude/skills/$name/$sub"
      [[ "$DRY_RUN" == "1" ]] || cp -R "$dir/$sub/." "$ROOT/.claude/skills/$name/$sub/"
      echo "synced $sub $name"
    fi
  done
done

if [[ "$DRY_RUN" != "1" ]]; then
  cp "$ROOT/.agent/rules/README.md" "$ROOT/.claude/rules/README.md"
fi
if [[ -f "$ROOT/.claude/rules/README.md" ]]; then
  # Tool-specific title/blurb after Agent mirror copy
  # `node -` forces script mode: a bare `node <<` starts the REPL under Git Bash on Windows.
  node - <<'NODE'
const fs = require("fs");
const path = require("path");
const p = path.join(process.cwd(), ".claude/rules/README.md");
let s = fs.readFileSync(p, "utf8");
s = s
  .replace(/^# MMS Agent Rules\b/m, "# MMS Claude Rules")
  .replace(/^# MMS Cursor Rules\b/m, "# MMS Claude Rules")
  .replace(
    /Antigravity loads `\.md` files from this directory \(synced from Cursor `\.mdc`\)\./g,
    "Claude Code loads `.md` files from this directory (synced from Cursor `.mdc`)."
  )
  .replace(
    /Claude Code loads\s+files from this directory \(synced from Cursor\s*\)\./g,
    "Claude Code loads `.md` files from this directory (synced from Cursor `.mdc`)."
  );
fs.writeFileSync(p, s);
NODE
fi
[[ "$DRY_RUN" == "1" ]] || cp "$ROOT/.agent/skills/README.md" "$ROOT/.claude/skills/README.md"

if [[ "$DRY_RUN" != "1" ]]; then
  mkdir -p "$ROOT/.claude/docs/workflows"
  cp "$ROOT/.agent/workflows/"*.md "$ROOT/.claude/docs/workflows/"
fi

DRY_SUFFIX=""
if [[ "$DRY_RUN" == "1" ]]; then
  DRY_SUFFIX=" (dry-run)"
fi
echo "Done${DRY_SUFFIX}. Claude mirror: .claude/rules/ + .claude/skills/"

