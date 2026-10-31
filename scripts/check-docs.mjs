#!/usr/bin/env node
/**
 * Documentation ratchets.
 *
 *   1. `missingIndexEntries` — every top-level `docs/<name>.md` (except the index)
 *      and every `docs/<subdir>/` must be linked from `docs/README.md`.
 *   2. `adrNumbering` — `docs/adr/<file>.md` use `NNN-` (or `NNNN-`) unique numbers.
 *   3. `strayDsStore` — no macOS `.DS_Store` under `docs/`.
 *   4. `legacyCursorrules` — the legacy `.cursorrules` stub must not exist.
 *   5. `brokenLinks` — every relative markdown link in the docs corpus (docs/,
 *      README.md, SYSTEM_ARCHITECTURE.md, CONTRIBUTING.md, AGENTS.md) resolves to
 *      a file that exists. This is what catches the `file:///Users/<name>/…`
 *      links and renamed files that no other gate noticed.
 *
 *   node scripts/check-docs.mjs [--json] [--update-baselines]
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DOCS = path.join(ROOT, "docs");
const INDEX = path.join(DOCS, "README.md");
const ADR_DIR = path.join(DOCS, "adr");

const BASELINE = {
  missingIndexEntries: 0,
  adrNumbering: 0,
  strayDsStore: 0,
  legacyCursorrules: 0,
  brokenLinks: 0,
};

const isDir = (p) => {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};

const indexContent = fs.existsSync(INDEX) ? fs.readFileSync(INDEX, "utf8") : "";
const missingIndexEntries = [];
for (const entry of fs.readdirSync(DOCS, { withFileTypes: true })) {
  const name = entry.name;
  if (entry.isDirectory()) {
    if (!indexContent.includes(`${name}/`)) missingIndexEntries.push(`docs/${name}/`);
  } else if (name.endsWith(".md") && name !== "README.md") {
    if (!indexContent.includes(name)) missingIndexEntries.push(`docs/${name}`);
  }
}

const adrFiles = isDir(ADR_DIR)
  ? fs.readdirSync(ADR_DIR).filter((f) => f.endsWith(".md") && f !== "README.md")
  : [];
const adrNumbering = [];
{
  const seen = new Map();
  for (const f of adrFiles) {
    const m = /^(\d{3,4})-[a-z0-9-]+\.md$/.exec(f);
    if (!m) {
      adrNumbering.push(`docs/adr/${f} (expected NNN-slug.md)`);
      continue;
    }
    if (seen.has(m[1])) adrNumbering.push(`docs/adr/${f} (duplicate number ${m[1]})`);
    seen.set(m[1], f);
  }
}

const strayDsStore = [];
{
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name === ".DS_Store") strayDsStore.push(path.relative(ROOT, full));
    }
  };
  if (isDir(DOCS)) walk(DOCS);
}
const legacyCursorrules = fs.existsSync(path.join(ROOT, ".cursorrules")) ? [".cursorrules"] : [];

/**
 * Relative markdown links that point at a file which does not exist.
 *
 * External URLs, anchors-only links and `mailto:` are ignored; absolute
 * `file:///…` links are reported unconditionally because they only resolve on
 * the machine that wrote them.
 */
const brokenLinks = [];
{
  const DOC_ROOTS = ["docs", "README.md", "SYSTEM_ARCHITECTURE.md", "CONTRIBUTING.md", "AGENTS.md"];
  const markdownFiles = [];
  const collect = (target) => {
    const full = path.join(ROOT, target);
    if (!fs.existsSync(full)) return;
    if (isDir(full)) {
      for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
        if (entry.name === "archive" || entry.name === "node_modules") continue;
        collect(path.join(target, entry.name));
      }
    } else if (target.endsWith(".md")) {
      markdownFiles.push(target);
    }
  };
  DOC_ROOTS.forEach(collect);

  const LINK = /\]\(([^)\s]+)\)/g;
  for (const file of markdownFiles) {
    const content = fs.readFileSync(path.join(ROOT, file), "utf8");
    for (const match of content.matchAll(LINK)) {
      const rawTarget = match[1];
      if (!rawTarget || rawTarget.startsWith("#")) continue;
      if (/^[a-z]+:/i.test(rawTarget) && !rawTarget.startsWith("file:")) continue;
      if (rawTarget.startsWith("file:")) {
        brokenLinks.push(`${file}: ${rawTarget} (absolute file:// link)`);
        continue;
      }
      const withoutAnchor = rawTarget.split("#")[0];
      if (!withoutAnchor) continue;
      const resolved = path.resolve(path.dirname(path.join(ROOT, file)), withoutAnchor);
      if (!fs.existsSync(resolved)) {
        brokenLinks.push(`${file}: ${rawTarget}`);
      }
    }
  }
}

const results = [
  {
    name: "Docs missing from docs/README.md index",
    norm: "docs/README.md (index completeness)",
    count: missingIndexEntries.length,
    baseline: BASELINE.missingIndexEntries,
    sample: missingIndexEntries,
  },
  {
    name: "ADR filename numbering (NNN-slug.md, unique)",
    norm: "docs/adr/README.md",
    count: adrNumbering.length,
    baseline: BASELINE.adrNumbering,
    sample: adrNumbering,
  },
  {
    name: "Stray .DS_Store under docs/",
    norm: ".gitignore §10",
    count: strayDsStore.length,
    baseline: BASELINE.strayDsStore,
    sample: strayDsStore,
  },
  {
    name: "Legacy .cursorrules present",
    norm: "mms-agent-universal.md",
    count: legacyCursorrules.length,
    baseline: BASELINE.legacyCursorrules,
    sample: legacyCursorrules,
  },
  {
    name: "Broken relative links in the docs corpus",
    norm: "docs/README.md (documentation integrity)",
    count: brokenLinks.length,
    baseline: BASELINE.brokenLinks,
    sample: brokenLinks.slice(0, 10),
  },
];

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ results }, null, 2));
  process.exit(0);
}

if (process.argv.includes("--update-baselines")) {
  const newBaseline = { ...BASELINE };
  let updated = false;
  results.forEach((result, index) => {
    if (result.count < result.baseline) {
      newBaseline[Object.keys(BASELINE)[index]] = result.count;
      updated = true;
    }
  });
  if (updated) {
    const scriptPath = path.join(ROOT, "scripts/check-docs.mjs");
    const content = fs.readFileSync(scriptPath, "utf8");
    const literal = `const BASELINE = {\n${Object.entries(newBaseline)
      .map(([k, v]) => `  ${k}: ${v},`)
      .join("\n")}\n};`;
    fs.writeFileSync(
      scriptPath,
      content.replace(/const BASELINE = \{[\s\S]*?\};/, literal),
      "utf8",
    );
    console.log("✅ Baselines ratcheted down:", newBaseline);
  } else {
    console.log("ℹ️ No baseline improvements to update.");
  }
  process.exit(0);
}

let regressions = 0;
for (const result of results) {
  const delta = result.count - result.baseline;
  console.log(
    `${delta > 0 ? "✗" : "✓"} ${result.name}: ${result.count} (baseline ${result.baseline})  [${result.norm}]`,
  );
  if (delta > 0) {
    regressions++;
    for (const site of result.sample.slice(0, 12)) console.log(`      ${site}`);
  }
}

console.log("");
if (regressions > 0) {
  console.error(
    "💥 docs ratchet(s) regressed. Add the doc to docs/README.md, fix ADR filenames, or clear the clutter — or lower the BASELINE in scripts/check-docs.mjs with a reviewed reason.",
  );
  process.exit(1);
}
console.log("✅ All docs ratchets held.");
