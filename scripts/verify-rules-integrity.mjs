#!/usr/bin/env node
/**
 * MMS agent-standards verifier.
 *
 * Validates the rule/skill corpus in .cursor/rules + .agent/skills against:
 *   1. skill inventory parity (disk ↔ manifest ↔ AGENTS.md ↔ CLAUDE.md)
 *   2. rule always-on parity (Cursor frontmatter ↔ manifest ↔ docs)
 *   3. SKILL.md frontmatter conformance (Agent Skills spec limits)
 *   4. rule→skill / skill→rule reference integrity
 *   5. backticked path existence, in EVERY skill file (incl. examples/ + references/)
 *   6. import-specifier resolution for skill examples (alias-aware)
 *   7. script/references/examples reachability + executable bit for skill scripts/
 *   8. skill description "Use when" + body "## Related skills" + "## When to use" (fail)
 *   8. section citations (§N must resolve to a real heading number)
 *   9. Cursor `globs:` frontmatter validity (existing base dir, non-empty match)
 *  10. freshness metadata (warn-only)
 *  11. workflow ↔ slash-command ↔ agent mirror parity (.agent/workflows, .cursor/commands, .claude/commands, .claude/agents)
 *
 * Errors fail the run; warnings never do. Exit code 1 on any error.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

// Windows has no exec bit on disk; read the mode git records instead.
const gitExecutables =
  process.platform === 'win32'
    ? new Set(
        execFileSync('git', ['ls-files', '-s', '--', '.agent/skills'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 })
          .split('\n')
          .filter((line) => line.startsWith('100755 '))
          .map((line) => path.join(ROOT, line.slice(line.indexOf('\t') + 1))),
      )
    : null;
const isExecutable = (file) =>
  gitExecutables ? gitExecutables.has(file) : (fs.statSync(file).mode & 0o111) !== 0;
const cursorRulesDir = path.join(ROOT, '.cursor/rules');
const skillsDir = path.join(ROOT, '.agent/skills');
const manifestPath = path.join(ROOT, '.agent/skills-manifest.json');
const claudeMdPath = path.join(ROOT, 'CLAUDE.md');
const agentsMdPath = path.join(ROOT, 'AGENTS.md');

let errors = 0;
let warnings = 0;

const fail = (msg) => {
  console.error(`❌ [RULE INTEGRITY ERROR] ${msg}`);
  errors++;
};
const warn = (msg) => {
  console.log(`⚠️  [warn] ${msg}`);
  warnings++;
};
const pass = (msg) => console.log(`✅ ${msg}`);

// ─────────────────────────────────────────────────────────────────────────────
// Repo indexing helpers
// ─────────────────────────────────────────────────────────────────────────────

const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage', '.turbo', '.pnpm-store',
  'playwright-report', 'test-results', 'blob-report', '.vitest-reports', '.logs',
]);

/** Basename → relative paths, for bare-filename references like `SubTabBar.tsx`. */
const fileIndex = new Map();
(function buildFileIndex(dir = ROOT) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      buildFileIndex(full);
    } else {
      const list = fileIndex.get(entry.name) ?? [];
      list.push(path.relative(ROOT, full).replaceAll(path.sep, '/'));
      fileIndex.set(entry.name, list);
    }
  }
})();

const isFile = (p) => {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
};
const isDir = (p) => {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};

/** True when a repo-relative path (globs allowed) resolves to something real. */
function pathExists(repoRel) {
  if (fs.existsSync(path.join(ROOT, repoRel))) return true;
  if (fileIndex.has(path.basename(repoRel))) return true;
  return false;
}

const TS_EXTENSIONS = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '/index.ts', '/index.tsx', '/index.js'];

/**
 * Case-SENSITIVE existence check. A macOS/Windows dev machine resolves
 * `@/components/ui/Skeleton` even when the file is `skeleton.tsx`, so a
 * case-insensitive stat() check would pass locally and break the Linux deploy
 * (`mms-linux-compatibility.mdc`). Compare against the real directory entries.
 */
function resolvesToFile(absPath) {
  const rel = path.relative(ROOT, absPath);
  if (rel.startsWith('..')) return false;
  for (const ext of TS_EXTENSIONS) {
    const candidate = `${rel}${ext}`.split(path.sep).join('/');
    const directory = path.dirname(path.join(ROOT, candidate));
    const base = path.basename(candidate);
    let entries;
    try {
      entries = fs.readdirSync(directory);
    } catch {
      continue;
    }
    if (entries.includes(base)) return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Inventory
// ─────────────────────────────────────────────────────────────────────────────

const diskSkills = fs
  .readdirSync(skillsDir, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

const ruleFiles = fs.readdirSync(cursorRulesDir).filter((f) => f.endsWith('.mdc')).sort();
const knownRuleNames = new Set(ruleFiles.map((f) => f.replace(/\.mdc$/, '')));
const knownSkillNames = new Set(diskSkills);

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const manifestSkillNames = new Set((manifest.skills ?? []).map((s) => s.name));

const missingFromManifest = diskSkills.filter((s) => !manifestSkillNames.has(s));
const orphanManifestEntries = [...manifestSkillNames].filter((s) => !knownSkillNames.has(s));
if (missingFromManifest.length || orphanManifestEntries.length) {
  fail(
    'skills-manifest.json does not match disk\n' +
      `     missing from manifest: ${missingFromManifest.join(', ') || '(none)'}\n` +
      `     stale manifest entries: ${orphanManifestEntries.join(', ') || '(none)'}`,
  );
} else {
  pass(`Skill inventory matches manifest (${diskSkills.length})`);
}

const claudeMd = fs.readFileSync(claudeMdPath, 'utf8');
const agentsMd = fs.readFileSync(agentsMdPath, 'utf8');

// Counts are DERIVED from disk; the docs must simply agree. (They used to be
// hardcoded here, so adding a skill required editing the verifier itself.)
// CLAUDE.md is a thin wrapper that imports AGENTS.md, so it deliberately does
// NOT restate the count — instead we assert the import exists, because losing it
// would silently drop every project convention from a Claude session.
{
  const m = agentsMd.match(/(\d+) capability modules/) ?? agentsMd.match(/## Skills \((\d+)\)/);
  if (!m) {
    fail('AGENTS.md is missing its skill-count header');
  } else if (Number(m[1]) !== diskSkills.length) {
    fail(`AGENTS.md says ${m[1]} skills but disk has ${diskSkills.length}`);
  } else {
    pass(`AGENTS.md matches skill count (${diskSkills.length})`);
  }

  if (!/^@AGENTS\.md\s*$/m.test(claudeMd) && !/^@AGENTS\.md\b/m.test(claudeMd)) {
    fail('CLAUDE.md does not import AGENTS.md (`@AGENTS.md`) — Claude would load no project conventions');
  } else {
    pass('CLAUDE.md imports AGENTS.md');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Always-on parity
// ─────────────────────────────────────────────────────────────────────────────

const frontmatterOf = (file) => {
  const content = fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n');
  const m = content.match(/^---\n([\s\S]*?)\n---\n?/);
  return { front: m ? m[1] : '', body: m ? content.slice(m[0].length) : content };
};

const frontmatterAlwaysOn = ruleFiles
  .filter((file) => /^alwaysApply:\s*true\s*$/m.test(frontmatterOf(path.join(cursorRulesDir, file)).front))
  .map((file) => `rules/${file.replace(/\.mdc$/, '.md')}`)
  .sort();

const manifestAlwaysOn = [...(manifest.rules?.always_on ?? [])].sort();
const alwaysOnMismatch =
  frontmatterAlwaysOn.length !== manifestAlwaysOn.length ||
  frontmatterAlwaysOn.some((rule, i) => rule !== manifestAlwaysOn[i]);

if (alwaysOnMismatch) {
  fail(
    'Always-on rules disagree between .cursor/rules frontmatter and skills-manifest.json\n' +
      `     frontmatter:  ${frontmatterAlwaysOn.join(', ') || '(none)'}\n` +
      `     manifest:     ${manifestAlwaysOn.join(', ') || '(none)'}`,
  );
} else {
  pass(`Always-on rules match frontmatter (${frontmatterAlwaysOn.length})`);
}

const agentsAlwaysOnSection = agentsMd.split(/^## /m).find((s) => /^Always-on rules/i.test(s)) ?? '';
const missingFromAgents = frontmatterAlwaysOn.filter((rule) => !agentsAlwaysOnSection.includes(rule));
if (missingFromAgents.length) {
  fail(`AGENTS.md always-on section omits: ${missingFromAgents.join(', ')}`);
} else {
  pass('AGENTS.md always-on section lists every always-on rule');
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Headings + citation resolution
// ─────────────────────────────────────────────────────────────────────────────

/** Heading numbers owned by a document: only `## 4.` / `### 5.1` style headings count. */
const headingNumbers = new Map();
function indexHeadings(key, content) {
  const numbers = new Set();
  let currentSection = null;
  for (const line of content.split('\n')) {
    const heading = line.match(/^#{1,6}\s+(\d+)(?:\.(\d+))?[.\s)]/);
    if (heading) {
      currentSection = heading[1];
      numbers.add(heading[1]);
      if (heading[2]) numbers.add(`${heading[1]}.${heading[2]}`);
      continue;
    }
    // Numbered list items inside a numbered section are addressable as N.M.
    const item = line.match(/^\s*(\d+)\.\s+\S/);
    if (item && currentSection) numbers.add(`${currentSection}.${item[1]}`);
  }
  headingNumbers.set(key, numbers);
}

for (const file of ruleFiles) {
  const content = fs.readFileSync(path.join(cursorRulesDir, file), 'utf8');
  const base = file.replace(/\.mdc$/, '');
  for (const key of [file, `${base}.md`, base]) indexHeadings(key, content);
}

const docsDir = path.join(ROOT, 'docs');
if (isDir(docsDir)) {
  for (const file of fs.readdirSync(docsDir).filter((f) => f.endsWith('.md'))) {
    const content = fs.readFileSync(path.join(docsDir, file), 'utf8');
    indexHeadings(file, content);
    indexHeadings(`docs/${file}`, content);
  }
}

/** `§N` / `§N.M` citations must map to a heading number that actually exists. */
function checkCitations(citationText, citeFile, ownerLabel) {
  const citations = citationText.matchAll(
    /([a-zA-Z0-9_./-]+\.mdc?|docs\/[a-zA-Z0-9_.-]+\.md)[`\])\s]*(?:§|section\s+)(\d+(?:\.\d+)?)/gi,
  );
  for (const [, target, rawSection] of citations) {
    const numbers = headingNumbers.get(target) ?? headingNumbers.get(path.basename(target));
    if (!numbers) {
      fail(`In ${ownerLabel}: references unknown rule or doc ${target}`);
      continue;
    }
    // A dotted citation (5.1) may resolve to either the section or the sub-item;
    // `headingNumbers` already holds both forms.
    if (!numbers.has(rawSection)) {
      fail(`In ${ownerLabel}: referenced section §${rawSection} does not exist in ${target} (${citeFile})`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Glob frontmatter validation (.cursor/rules/*.mdc)
// ─────────────────────────────────────────────────────────────────────────────

/** Convert a Cursor glob into an anchored RegExp. */
function globToRegExp(glob) {
  let out = "";
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === "*") {
      if (glob[i + 1] === "*") {
        if (glob[i + 2] === "/") { out += "(?:.*/)?"; i += 2; } else { out += ".*"; i += 1; }
      } else out += "[^/]*";
    } else if (ch === "?") out += "[^/]";
    else out += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp("^" + out + "$");
}

const allRepoFiles = [...fileIndex.values()].flat();

/**
 * A glob is valid when at least one tracked file matches it. Catches dead
 * paths (a removed directory) and typos that silently match nothing.
 */
function globMatchesAnything(glob) {
  const re = globToRegExp(glob);
  return allRepoFiles.some((f) => re.test(f));
}

const allGlobs = new Map(); // glob string → rules declaring it
for (const file of ruleFiles) {
  const { front } = frontmatterOf(path.join(cursorRulesDir, file));
  const globLine = front.match(/^globs:\s*(.+)$/m);
  if (!globLine) continue;
  const globs = globLine[1].split(',').map((g) => g.trim()).filter(Boolean);
  for (const glob of globs) {
    if (!globMatchesAnything(glob)) {
      fail(`In ${file}: glob matches no file in the repo: ${glob}`);
    }
    const declaring = allGlobs.get(glob) ?? [];
    declaring.push(file);
    allGlobs.set(glob, declaring);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Skill files: frontmatter, references, paths, imports, scripts
// ─────────────────────────────────────────────────────────────────────────────

const AGENT_SKILLS_PREFIX = '.agent/skills';
const PACKAGE_NAMES = new Set(['@mms/shared', '@mms/backend', 'mms-backend', 'mms-frontend', 'e2e-tests']);
const NODE_BUILTIN = /^node:/;

/**
 * Tokens that look like mms-* rule/skill names but are not one:
 * package names, plugin names, env vars, cookies, hosts. Verified real.
 */
const KNOWN_MMS_TOKENS = new Set([
  'mms-backend', 'mms-frontend', 'mms-shared', 'mms-boundary', 'mms-bidi',
  'mmsv2', 'mmsv2-worker', 'mms-production-ports', 'mms_access',
  'mms_tenant_session', 'mms-app', 'mms-monorepo', 'mms-db', 'mms-dist',
]);

/** Resolve an import specifier written inside a skill example file. */
function importResolves(specifier, containingFile) {
  if (specifier.startsWith('.')) {
    return resolvesToFile(path.resolve(path.dirname(containingFile), specifier));
  }
  if (specifier.startsWith('@/')) {
    return resolvesToFile(path.join(ROOT, 'apps/frontend/src', specifier.slice(2)));
  }
  return true; // bare package specifier — out of scope here
}

const MAX_DESCRIPTION = 1024;
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Naming-convention patterns in tables (e.g. `kebab-case.sh`) and gitignored seed artifacts are not tracked files. */
const CONVENTION_TOKENS = new Set(['kebab-case.sh', 'kebab-case.ts', 'PascalCase.tsx', 'camelCase.ts', 'snake_case.ts', 'seeds.json']);

const today = new Date();
const FRESHNESS_DAYS = 180;

for (const skill of diskSkills) {
  const skillDir = path.join(skillsDir, skill);
  const skillFile = path.join(skillDir, 'SKILL.md');
  if (!isFile(skillFile)) {
    fail(`Missing SKILL.md in ${skill}`);
    continue;
  }
  const raw = fs.readFileSync(skillFile, 'utf8');
  const { front, body } = frontmatterOf(skillFile);

  const nameMatch = front.match(/^name:\s*([^\n]+)$/m);
  const descMatch = front.match(/^description:\s*([^\n]+)$/m);

  if (!/^---\r?\n/.test(raw) || !nameMatch || !descMatch) {
    fail(`Invalid or missing frontmatter in ${skill}/SKILL.md`);
    continue;
  }
  const name = nameMatch[1].trim();
  const description = descMatch[1].trim();

  if (name !== skill) fail(`Skill name mismatch: directory '${skill}' vs frontmatter '${name}'`);
  if (name.length > 64) fail(`Skill ${skill}: name exceeds 64 characters`);
  if (!NAME_RE.test(name)) fail(`Skill ${skill}: name must be lowercase alphanumeric with single hyphens`);
  if (description.length > MAX_DESCRIPTION) {
    fail(`Skill ${skill}: description is ${description.length} chars (max ${MAX_DESCRIPTION})`);
  }
  if (!/Do not use|Do NOT use/i.test(description)) {
    fail(`Skill ${skill}: description lacks an explicit negative routing boundary ("Do NOT use for…")`);
  }
  if (!/Use when/i.test(description)) {
    fail(`Skill ${skill}: description lacks an explicit "Use when…" trigger clause`);
  }
  if (!body.includes('**Rule (norms SSOT):**') && !body.includes('**Rules (norms SSOT):**')) {
    fail(`Skill ${skill}: missing '**Rule (norms SSOT):**' header`);
  }
  if (!/^##+\s*Related skills?\b/m.test(body)) {
    fail(`Skill ${skill}: missing '## Related skills' section`);
  }
  if (!/^##+\s*When to use\b/m.test(body)) {
    fail(`Skill ${skill}: missing '## When to use' body section`);
  }

  // Freshness metadata (warn-only so it never blocks a fix-forward commit).
  const verified = front.match(/^\s*last-verified:\s*(\S+)/m);
  if (!verified) {
    warn(`Skill ${skill}: no metadata.last-verified (staleness is untracked)`);
  } else {
    const age = (today - new Date(verified[1])) / 86_400_000;
    if (Number.isNaN(age)) warn(`Skill ${skill}: metadata.last-verified is not a date`);
    else if (age > FRESHNESS_DAYS) warn(`Skill ${skill}: metadata.last-verified is ${Math.round(age)} days old`);
  }

  const sectionNames = [skill];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else sectionNames.push(path.relative(ROOT, full));
    }
  };
  walk(skillDir);

  const label = (file) => path.relative(ROOT, file);

  for (const rel of sectionNames) {
    const file = path.join(ROOT, rel);
    if (!rel.endsWith('.md') && !rel.endsWith('.ts') && !rel.endsWith('.tsx') && !rel.endsWith('.sql') && !rel.endsWith('.mjs')) {
      continue;
    }
    const content = fs.readFileSync(file, 'utf8');
    const ownerLabel = rel === skill ? `skill ${skill}` : `skill ${skill} (${path.relative(skillDir, file)})`;

    checkCitations(content, file, ownerLabel);

    // Backticked paths: repo-anchored roots, plus e2e/ (previously excluded —
    // that blind spot let a deleted Playwright spec keep passing).
    const pathMatches = content.matchAll(
      /`((?:apps|packages|scripts|docs|e2e|\.agent|\.cursor|\.claude|\.github)\/[^`\s]+)`/g,
    );
    for (const m of pathMatches) {
      const candidate = m[1].split('#')[0].split('?')[0].replace(/[.,;:]$/, '');
      if (/[*{[]|\.\.\./.test(candidate)) continue;
      if (candidate.endsWith('.env')) continue;
      if (!pathExists(candidate)) {
        fail(`In ${ownerLabel}: referenced path does not exist on disk: ${candidate}`);
      }
    }

    // Bare filenames in backticks (`Foo.tsx`) must exist somewhere in the repo.
    const bareMatches = content.matchAll(/`([A-Za-z0-9_.-]+\.(?:tsx?|mjs|cjs|sql|json|sh))`/g);
    for (const m of bareMatches) {
      const candidate = m[1];
      if (CONVENTION_TOKENS.has(candidate)) continue;
      if (!fileIndex.has(candidate)) {
        fail(`In ${ownerLabel}: referenced filename does not exist anywhere in the repo: ${candidate}`);
      }
    }

    // Alias imports (`@/…`) must resolve into the frontend src tree. Relative
    // specifiers inside examples/ are skipped: those files are templates that
    // are copied into the app tree, so their relative depth is contextual.
    if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      const inExamples = /[\\/]examples[\\/]/.test(file);
      const imports = content.matchAll(/from\s+['"]([^'"]+)['"]/g);
      for (const m of imports) {
        const specifier = m[1];
        if (NODE_BUILTIN.test(specifier)) continue;
        if (specifier.startsWith('.') && inExamples) continue;
        if (!specifier.startsWith('.') && !specifier.startsWith('@/')) continue; // external package
        if (importResolves(specifier, file)) continue;
        fail(`In ${ownerLabel}: import does not resolve: '${specifier}'`);
      }
    }
  }

  // Skill scripts must be executable AND reachable from SKILL.md, or they are
  // dead weight that never runs. references/ and examples/ share the
  // reachability invariant (skip __pycache__, *.pyc, and dotfiles).
  const assetDirs = [
    { name: 'scripts', requireExecutable: true },
    { name: 'references', requireExecutable: false },
    { name: 'examples', requireExecutable: false },
  ];
  const walkAssetFiles = (dir, out = []) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '__pycache__' || entry.name.startsWith('.')) continue;
      if (entry.name.endsWith('.pyc')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walkAssetFiles(full, out);
      else out.push(full);
    }
    return out;
  };
  for (const { name: assetName, requireExecutable } of assetDirs) {
    const assetDir = path.join(skillDir, assetName);
    if (!isDir(assetDir)) continue;
    for (const assetPath of walkAssetFiles(assetDir)) {
      const basenames = [path.basename(assetPath)];
      const relFromSkill = path.relative(skillDir, assetPath).split(path.sep).join('/');
      if (requireExecutable && !isExecutable(assetPath)) {
        fail(`Skill ${skill}: script '${basenames[0]}' is not executable`);
      }
      const mentioned = raw.includes(basenames[0]) || raw.includes(relFromSkill);
      if (!mentioned) {
        fail(`Skill ${skill}: ${assetName} file '${relFromSkill}' is never referenced from SKILL.md`);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Rule-side path checks + rule↔skill reference integrity
// ─────────────────────────────────────────────────────────────────────────────

for (const file of ruleFiles) {
  const raw = fs.readFileSync(path.join(cursorRulesDir, file), 'utf8');
  checkCitations(raw, file, file);

  const pathMatches = raw.matchAll(
    /`((?:apps|packages|scripts|docs|e2e|\.agent|\.cursor|\.claude|\.github)\/[^`\s]+)`/g,
  );
  for (const m of pathMatches) {
    const candidate = m[1].split('#')[0].split('?')[0].replace(/[.,;:]$/, '');
    if (/[*{[]|\.\.\./.test(candidate)) continue;
    if (candidate.endsWith('.env')) continue;
    if (!pathExists(candidate)) fail(`In ${file}: referenced path does not exist on disk: ${candidate}`);
  }

  const bareMatches = raw.matchAll(/`([A-Za-z0-9_.-]+\.(?:tsx?|mjs|cjs|sql|json|sh))`/g);
  for (const m of bareMatches) {
    if (CONVENTION_TOKENS.has(m[1])) continue;
    if (!fileIndex.has(m[1])) {
      fail(`In ${file}: referenced filename does not exist anywhere in the repo: ${m[1]}`);
    }
  }

  // Any skill or rule named in a rule should exist. Unknown mms-* tokens are
  // warnings only: some are legitimate code/package identifiers, but a stale
  // router target must still be visible.
  for (const m of raw.matchAll(/`?(mms-[a-z0-9-]+|antigravity-workspace|ui-ux-pro-max)`?/g)) {
    const token = m[1];
    if (knownSkillNames.has(token) || knownRuleNames.has(token) || KNOWN_MMS_TOKENS.has(token)) continue;
    warn(`In ${file}: unrecognised mms-* token '${token}' (stale router target or real identifier?)`);
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// 7. Rule README counts
// ─────────────────────────────────────────────────────────────────────────────

const ruleReadme = path.join(cursorRulesDir, 'README.md');
if (isFile(ruleReadme)) {
  const readme = fs.readFileSync(ruleReadme, 'utf8');
  const alwaysOnClaim = readme.match(/## Always Applied \((\d+)\)/);
  const scopedClaim = readme.match(/## Scoped Rules \((\d+)\)/);
  if (!alwaysOnClaim || Number(alwaysOnClaim[1]) !== frontmatterAlwaysOn.length) {
    fail(
      `.cursor/rules/README.md always-on header says ${alwaysOnClaim?.[1] ?? '(missing)'}, frontmatter has ${frontmatterAlwaysOn.length}`,
    );
  }
  const scopedCount = ruleFiles.length - frontmatterAlwaysOn.length;
  if (!scopedClaim || Number(scopedClaim[1]) !== scopedCount) {
    fail(`.cursor/rules/README.md scoped header says ${scopedClaim?.[1] ?? '(missing)'}, disk has ${scopedCount}`);
  }
  if (alwaysOnClaim && scopedClaim) {
    pass(`Rule README counts match (${frontmatterAlwaysOn.length} always-on + ${scopedCount} scoped)`);
  }
}

const skillsReadme = path.join(skillsDir, 'README.md');
if (isFile(skillsReadme)) {
  const readme = fs.readFileSync(skillsReadme, 'utf8');
  const m = readme.match(/## Skills index \((\d+)\)/);
  if (!m) fail('.agent/skills/README.md is missing its "## Skills index (N)" header');
  else if (Number(m[1]) !== diskSkills.length) {
    fail(`.agent/skills/README.md says ${m[1]} skills, disk has ${diskSkills.length}`);
  } else {
    pass(`Skills README index matches disk (${diskSkills.length})`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Workflow command wrappers + Claude agent definitions
// ─────────────────────────────────────────────────────────────────────────────

/** Markdown basenames (no extension, README excluded) in a directory. */
const mdBasenames = (dir) => {
  if (!isDir(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .map((f) => f.replace(/\.md$/, ''))
    .sort();
};

const workflowsDir = path.join(ROOT, '.agent/workflows');
const cursorCommandsDir = path.join(ROOT, '.cursor/commands');
const claudeCommandsDir = path.join(ROOT, '.claude/commands');
const claudeAgentsDir = path.join(ROOT, '.claude/agents');

const workflowNames = mdBasenames(workflowsDir);
const cursorCommandNames = mdBasenames(cursorCommandsDir);
const claudeCommandNames = mdBasenames(claudeCommandsDir);

const sameSet = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

if (!sameSet(workflowNames, cursorCommandNames)) {
  fail(
    `.cursor/commands/*.md must mirror .agent/workflows/*.md — ` +
      `workflows: [${workflowNames.join(', ')}] vs cursor commands: [${cursorCommandNames.join(', ')}]`,
  );
}
if (!sameSet(workflowNames, claudeCommandNames)) {
  fail(
    `.claude/commands/*.md must mirror .agent/workflows/*.md — ` +
      `workflows: [${workflowNames.join(', ')}] vs claude commands: [${claudeCommandNames.join(', ')}]`,
  );
}

for (const [dir, names] of [
  [cursorCommandsDir, cursorCommandNames],
  [claudeCommandsDir, claudeCommandNames],
]) {
  for (const name of names) {
    const abs = path.join(dir, `${name}.md`);
    const rel = path.relative(ROOT, abs).replaceAll(path.sep, '/');
    const raw = fs.readFileSync(abs, 'utf8');
    const front = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
    if (!/^description:/m.test(front)) {
      fail(`${rel}: command wrapper is missing a frontmatter 'description:'`);
    }
    if (!raw.includes(`.agent/workflows/${name}.md`)) {
      fail(`${rel}: command wrapper must reference its canonical .agent/workflows/${name}.md`);
    }
  }
}

const agentsMdSource = isFile(agentsMdPath) ? fs.readFileSync(agentsMdPath, 'utf8') : '';
const claudeMdSource = isFile(claudeMdPath) ? fs.readFileSync(claudeMdPath, 'utf8') : '';
const agentNames = mdBasenames(claudeAgentsDir);

for (const name of agentNames) {
  const rel = `.claude/agents/${name}.md`;
  const raw = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const front = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
  if (!front) {
    fail(`${rel}: missing frontmatter block`);
    continue;
  }
  for (const key of ['name', 'description', 'tools']) {
    if (!new RegExp(`^${key}:`, 'm').test(front)) fail(`${rel}: frontmatter is missing '${key}:'`);
  }
  const declaredName = front.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  if (declaredName && declaredName !== name) {
    fail(`${rel}: frontmatter name '${declaredName}' does not match filename '${name}'`);
  }
  if (!agentsMdSource.includes(name) && !claudeMdSource.includes(name)) {
    fail(`${rel}: agent '${name}' is referenced from neither AGENTS.md nor CLAUDE.md`);
  }
}

if (workflowNames.length > 0 || agentNames.length > 0) {
  pass(
    `Workflow/command/agent mirrors verified (${workflowNames.length} workflows, ` +
      `${cursorCommandNames.length} Cursor + ${claudeCommandNames.length} Claude commands, ${agentNames.length} agents)`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Result
// ─────────────────────────────────────────────────────────────────────────────

if (errors === 0) {
  console.log(
    `\n✨ All agent-standards checks passed (${diskSkills.length} skills, ${ruleFiles.length} rules` +
      `${warnings ? `, ${warnings} warning(s)` : ''}).\n`,
  );
  process.exit(0);
} else {
  console.error(`\n💥 Agent-standards check failed with ${errors} error(s).\n`);
  process.exit(1);
}
