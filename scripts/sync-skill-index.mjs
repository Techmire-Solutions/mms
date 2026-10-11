#!/usr/bin/env node
/**
 * Sync the three hand-maintained indexes with the skills on disk:
 *   .agent/skills-manifest.json  → add/remove entries
 *   .agent/skills/README.md      → regenerate the skills index table (count + rows)
 *   AGENTS.md                    → keep the "## Skills (N)" header truthful
 *
 * Existing manifest entries keep their curated keywords; new ones are seeded from
 * the skill description. Idempotent.
 */
import fs from "node:fs";
import path from "node:path";

const SKILLS_DIR = ".agent/skills";
const MANIFEST = ".agent/skills-manifest.json";

const skills = fs
  .readdirSync(SKILLS_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

const readFrontmatter = (skill) => {
  const file = path.join(SKILLS_DIR, skill, "SKILL.md");
  const content = fs.readFileSync(file, "utf8");
  const front = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
  const description = front.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? "";
  return { description, content };
};

/** "Use when <clause>." → short index label. */
const useWhenLabel = (description) => {
  const m = description.match(/Use when (.*?)(?:\.\s+Do NOT|\.$)/i);
  if (!m) return description.slice(0, 80);
  return m[1].charAt(0).toUpperCase() + m[1].slice(1);
};

const keywordsFor = (skill, description) =>
  [
    ...new Set(
      description
        .toLowerCase()
        .replace(/[^a-z0-9\s/-]/g, " ")
        .split(/\s+/)
        .filter(
          (w) =>
            w.length > 3 && !["when", "with", "that", "this", "from", "into", "your"].includes(w),
        ),
    ),
  ].slice(0, 10);

// 1. manifest
const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
const existing = new Map(manifest.skills.map((s) => [s.name, s]));
manifest.skills = skills.map((skill) => {
  const prior = existing.get(skill);
  if (prior) return prior;
  const { description } = readFrontmatter(skill);
  return { name: skill, path: `skills/${skill}`, keywords: keywordsFor(skill, description) };
});
fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);

// 2. skills README index
const readmePath = path.join(SKILLS_DIR, "README.md");
let readme = fs.readFileSync(readmePath, "utf8");
const rows = skills
  .map((skill) => {
    const { description } = readFrontmatter(skill);
    return `| [${skill}](${skill}/SKILL.md) | ${useWhenLabel(description)} |`;
  })
  .join("\n");

const indexSection = `## Skills index (${skills.length})\n\n| Skill | Use when |\n|-------|----------|\n${rows}\n\n`;
const INDEX_RE =
  /## Skills index \(\d+\)\n\n\| Skill \| Use when \|\n\|[-|]+\|\n[\s\S]*?(?=\n## |$)/;

if (INDEX_RE.test(readme)) {
  readme = readme.replace(INDEX_RE, indexSection.trimEnd());
} else if (readme.includes("## Rules vs skills")) {
  // Header/table missing (or never existed) — insert the whole section.
  readme = readme.replace("## Rules vs skills", `${indexSection}## Rules vs skills`);
} else {
  readme = `${readme.trimEnd()}\n\n${indexSection}`;
}
readme = readme.replace(/\((\d+) skills; rules:/, `(${skills.length} skills; rules:`);
fs.writeFileSync(readmePath, readme);

// 3. AGENTS.md header
const agentsPath = "AGENTS.md";
let agents = fs.readFileSync(agentsPath, "utf8");
agents = agents.replace(/## Skills \(\(\d+\)\)/, `## Skills (${skills.length})`);
agents = agents.replace(/## Skills \(\d+\)/, `## Skills (${skills.length})`);
agents = agents.replace(/(\d+) capability modules/, `${skills.length} capability modules`);
fs.writeFileSync(agentsPath, agents);

console.log(`synced ${skills.length} skills → manifest, skills README, AGENTS.md`);
