#!/usr/bin/env node
// Gate: the agent-facing guides stay in sync with the standards corpus they describe.
//
// Round 55 found `mms-contacts` present in `.agent/skills/` and in the skills README, but missing from the
// skills table in `AGENTS.md` — the most-read document in the repo, which also states a "Skills (51)" count
// that happened to be right. Counts and tables drift independently, so both are checked:
//
//   1. every `.agent/skills/<name>/SKILL.md` is named in `AGENTS.md` and in `.agent/skills/README.md`;
//   2. the counts `AGENTS.md` states ("Skills (N)", "**N rules**") equal the corpus on disk;
//   3. every `.cursor/rules/*.mdc` is named in `.cursor/rules/README.md` (the topic→rule→skill index);
//   4. every `.agent/workflows/*.md` is named in `AGENTS.md` (the workflow table + the slash-command list).
//
// Usage: node scripts/check-agent-skills-index.mjs [--json]

import fs from "node:fs";
import path from "node:path";

import { ROOT, EmptyScanError } from "./lib/repo-paths.mjs";

const SKILLS_DIR = path.join(ROOT, ".agent", "skills");
const SKILLS_INDEX = path.join(SKILLS_DIR, "README.md");
const AGENTS_MD = path.join(ROOT, "AGENTS.md");
const RULES_DIR = path.join(ROOT, ".cursor", "rules");
const RULES_INDEX = path.join(RULES_DIR, "README.md");
const WORKFLOWS_DIR = path.join(ROOT, ".agent", "workflows");

export function skillNames(dir = SKILLS_DIR) {
  if (!fs.existsSync(dir)) throw new EmptyScanError("check-agent-skills-index", dir);
  const names = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(dir, entry.name, "SKILL.md")))
    .map((entry) => entry.name)
    .sort();
  if (names.length === 0) throw new EmptyScanError("check-agent-skills-index", dir);
  return names;
}

export function ruleNames(dir = RULES_DIR) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".mdc"))
    .map((file) => file.replace(/\.mdc$/, ""))
    .sort();
}

/** A name counts as documented when it appears backticked or as a markdown link target. */
function mentions(text, name) {
  return (
    text.includes(`\`${name}\``) || text.includes(`${name}/SKILL.md`) || text.includes(`(${name})`)
  );
}

export function workflowNames(dir = WORKFLOWS_DIR) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => file.replace(/\.md$/, ""))
    .sort();
}

export function findDrift({
  skills = skillNames(),
  rules = ruleNames(),
  workflows = workflowNames(),
} = {}) {
  const agentsText = fs.readFileSync(AGENTS_MD, "utf8");
  const skillsIndexText = fs.existsSync(SKILLS_INDEX) ? fs.readFileSync(SKILLS_INDEX, "utf8") : "";
  const rulesIndexText = fs.existsSync(RULES_INDEX) ? fs.readFileSync(RULES_INDEX, "utf8") : "";

  const failures = [];

  for (const name of skills) {
    if (!mentions(agentsText, name)) failures.push(`AGENTS.md skills table is missing \`${name}\``);
    if (!mentions(skillsIndexText, name))
      failures.push(`.agent/skills/README.md is missing \`${name}\``);
  }

  for (const name of rules) {
    if (!rulesIndexText.includes(name))
      failures.push(`.cursor/rules/README.md is missing \`${name}\``);
  }

  for (const name of workflows) {
    if (!mentions(agentsText, name))
      failures.push(`AGENTS.md does not list the \`${name}\` workflow`);
  }

  const skillCount = agentsText.match(/## Skills \((\d+)\)/);
  if (!skillCount) {
    failures.push('AGENTS.md has no "## Skills (N)" heading to check');
  } else if (Number(skillCount[1]) !== skills.length) {
    failures.push(`AGENTS.md says Skills (${skillCount[1]}) but ${skills.length} exist`);
  }

  const ruleCount = agentsText.match(/\*\*(\d+) rules\*\*/);
  if (!ruleCount) {
    failures.push('AGENTS.md has no "**N rules**" claim to check');
  } else if (Number(ruleCount[1]) !== rules.length) {
    failures.push(`AGENTS.md says **${ruleCount[1]} rules** but ${rules.length} exist`);
  }

  return failures;
}

function main() {
  const json = process.argv.includes("--json");
  let failures;
  try {
    failures = findDrift();
  } catch (error) {
    if (error instanceof EmptyScanError) {
      console.error(`✗ ${error.message}`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  if (json) {
    process.stdout.write(`${JSON.stringify({ ok: failures.length === 0, failures }, null, 2)}\n`);
  } else if (failures.length === 0) {
    const skills = skillNames().length;
    const rules = ruleNames().length;
    const workflows = workflowNames().length;
    console.log(
      `✓ AGENTS.md and the index READMEs match the corpus (${skills} skills, ${rules} rules, ${workflows} workflows)`,
    );
  } else {
    console.error(`✗ agent guides are out of sync (${failures.length}):`);
    for (const failure of failures) console.error(`    ${failure}`);
    console.error(
      "\nFix: add the missing entry to the guide's table (and correct the count if it is stated), or remove\n" +
        "the stale entry. `bash .agent/scripts/sync-all.sh` regenerates the mirrors afterwards.",
    );
  }
  process.exitCode = failures.length === 0 ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) main();
