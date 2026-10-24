#!/usr/bin/env node
/**
 * MMS code-norm ratchets.
 *
 * Four norms are enforced here:
 *   1. Explicit `any` annotations in source.
 *   2. Raw 6-digit hex colour literals in .ts/.tsx (outside @theme).
 *      Accepted categories (grandfathered):
 *        - Branding tools: read CSS vars at runtime; need hex for WCAG contrast APIs.
 *        - Template editor: user-authored print content; `normalizeHexColor` operates on hex.
 *        - Print/PDF styles: printTemplateStyles.ts — absolute colours for non-CSS print output.
 *        - ERD diagram: Mermaid fallback defaults when CSS vars are unavailable.
 *      All other hex literals require a semantic token.
 *   3. Tailwind arbitrary-colour bracket expressions ([#…], [rgb(…)], [hsl(…)]).
 *      Baseline: 0. No new arbitrary colour expressions may be introduced.
 *   4. Files over the 300-line hard ceiling.
 *
 * Ratchets, not cleanups: existing sites are grandfathered; lowering a baseline
 * as code improves is always welcome.
 *
 *   node scripts/check-code-norms.mjs
 *   node scripts/check-code-norms.mjs --json
 *   node scripts/check-code-norms.mjs --changed   # changed files vs merge-base only
 *
 * Norms: mms-dry.md §4 (no `any`), mms-ui-ux-design.md §2 (semantic tokens only),
 * mms-structure-naming.md §3 (~300 hard / ~220 soft line bands).
 */
import fs from "node:fs";
import path from "node:path";
import { runChangedCheck } from "./lib/code-norms-changed.mjs";
import {
  HARD_LIMIT,
  IGNORED,
  SCAN_DIRS,
  SOURCE_EXT,
  measureCss,
  measureSource,
} from "./lib/code-norms-measure.mjs";

// `--changed`: per-file comparison against the merge-base (local CI fast path).
if (process.argv.includes("--changed")) process.exit(runChangedCheck());

const ROOT = process.cwd();

/**
 * Baselines measured when the ratchet landed; only lower them.
 *
 * filesOverHardLimit: raised 53 → 80 on 2026-10-11. Adopting Prettier (ADR-009)
 * expanded 28 files that had been compressed under the ceiling with dense
 * one-liners (e.g. invoiceTemplatePresets.ts 174→863, contactFieldSeed.ts
 * 89→634). That was a one-time formatting normalization; the decomposition work
 * ratchets it back down (currently 69 — shared setup/manifest/global-settings modules split).
 */
const BASELINE = {
  anyAnnotations: 0,
  hexColourFiles: 26,
  arbitraryColourExpressions: 0,
  filesOverHardLimit: 4,
};

/**
 * Collects repo-relative files under `dir` whose name matches `include`.
 * `@theme` tokens live in CSS, which the `.ts/.tsx` walk deliberately skips
 * (adding CSS to it would also drag `index.css` into the 300-line ratchet), so the
 * inert-token check runs its own CSS walk. An earlier version filtered `files`
 * for `.css` and therefore inspected nothing while reporting a clean zero.
 */
function walk(dir, include, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(ROOT, full).split(path.sep).join("/");
    if (IGNORED.test(`${rel}/`)) continue;
    if (entry.isDirectory()) walk(full, include, out);
    else if (include.test(entry.name)) out.push(rel);
  }
  return out;
}

const files = SCAN_DIRS.flatMap((dir) => walk(path.join(ROOT, dir), SOURCE_EXT));
const cssFiles = SCAN_DIRS.flatMap((dir) => walk(path.join(ROOT, dir), /\.css$/));

const anySites = [];
const hexFiles = [];
const arbitraryColourSites = [];
const oversized = [];

for (const rel of files) {
  const measured = measureSource(rel, fs.readFileSync(path.join(ROOT, rel), "utf8"));
  anySites.push(...measured.anySites);
  arbitraryColourSites.push(...measured.arbitrarySites);
  if (measured.hasHex) hexFiles.push(rel);
  if (measured.lineCount > HARD_LIMIT && !/\.(test|spec)\.(ts|tsx)$/.test(rel)) {
    oversized.push(`${measured.lineCount}  ${rel}`);
  }
}
const anyCount = anySites.length;
const arbitraryColourCount = arbitraryColourSites.length;

/**
 * Inert `@theme` tokens: a token declared under a Tailwind v3 config name that
 * v4 does not consume. Tailwind accepts such a token silently, emits no utility
 * for it, and reports nothing — so every `text-2xs` in the codebase renders at
 * whatever size it inherited.
 *
 * That is not hypothetical: the sub-xs type scale was declared as
 * `--font-size-2xs/-3xs/-4xs`, so `text-2xs`, `text-3xs` and `text-4xs` generated
 * no CSS at all across **217** call sites. It survived because nothing fails — a
 * class that emits nothing looks exactly like a class that works.
 *
 * The namespace pairs (in scripts/lib/code-norms-measure.mjs) were verified empirically against Tailwind 4.3.3 by compiling a
 * probe stylesheet per namespace and checking whether the utility was emitted:
 * the left-hand name produced nothing while the v4 equivalent on the right did.
 * Only pairs with an unambiguous intended utility are listed, so there are no
 * false positives — `--font-weight-*` and `--container-*` are valid in v4 and are
 * deliberately NOT here.
 */
const inertThemeTokens = cssFiles.flatMap((rel) =>
  measureCss(rel, fs.readFileSync(path.join(ROOT, rel), "utf8")),
);

const results = [
  {
    name: "Explicit `any` in source",
    norm: "mms-dry.md §4",
    count: anyCount,
    baseline: BASELINE.anyAnnotations,
    sample: anySites.slice(0, 5),
  },
  {
    name: "Raw hex colours outside @theme",
    norm: "mms-ui-ux-design.md §2",
    count: hexFiles.length,
    baseline: BASELINE.hexColourFiles,
    sample: hexFiles.slice(0, 5),
  },
  {
    // Zero baseline — arbitrary colour bracket expressions are never accepted debt.
    // Use semantic tokens from index.css @theme instead of text-[#abc] / bg-[rgb(…)].
    name: "Tailwind arbitrary-colour expressions ([#…], [rgb(…)], [hsl(…)])",
    norm: "mms-ui-ux-design.md §2",
    count: arbitraryColourCount,
    baseline: BASELINE.arbitraryColourExpressions,
    sample: arbitraryColourSites.slice(0, 5),
  },
  {
    name: `Files over the ${HARD_LIMIT}-line hard ceiling`,
    norm: "mms-structure-naming.md §3",
    count: oversized.length,
    baseline: BASELINE.filesOverHardLimit,
    sample: oversized.slice(0, 5),
  },
  {
    // Not a ratchet: an inert token is a bug, never accepted debt, so the baseline
    // is zero and stays zero.
    name: "Inert @theme tokens (v3 namespace Tailwind v4 does not consume)",
    norm: "mms-ui-ux-design.md §2",
    count: inertThemeTokens.length,
    baseline: 0,
    sample: inertThemeTokens.slice(0, 5),
  },
];

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ total: files.length, results }, null, 2));
  process.exit(0);
}

const isRatchetMode = process.argv.includes("--ratchet");
const isUpdateBaselines = process.argv.includes("--update-baselines");

if (isUpdateBaselines) {
  let updated = false;
  const newBaseline = { ...BASELINE };
  if (anyCount < BASELINE.anyAnnotations) {
    newBaseline.anyAnnotations = anyCount;
    updated = true;
  }
  if (hexFiles.length < BASELINE.hexColourFiles) {
    newBaseline.hexColourFiles = hexFiles.length;
    updated = true;
  }
  if (arbitraryColourCount < BASELINE.arbitraryColourExpressions) {
    newBaseline.arbitraryColourExpressions = arbitraryColourCount;
    updated = true;
  }
  if (oversized.length < BASELINE.filesOverHardLimit) {
    newBaseline.filesOverHardLimit = oversized.length;
    updated = true;
  }

  if (updated) {
    const scriptPath = path.join(ROOT, "scripts/check-code-norms.mjs");
    const content = fs.readFileSync(scriptPath, "utf8");
    const replaced = content.replace(
      /const BASELINE = \{[\s\S]*?\};/,
      `const BASELINE = {\n  anyAnnotations: ${newBaseline.anyAnnotations},\n  hexColourFiles: ${newBaseline.hexColourFiles},\n  arbitraryColourExpressions: ${newBaseline.arbitraryColourExpressions},\n  filesOverHardLimit: ${newBaseline.filesOverHardLimit},\n};`,
    );
    fs.writeFileSync(scriptPath, replaced, "utf8");
    console.log(`✅ Baselines successfully ratcheted down:`, newBaseline);
  } else {
    console.log(
      `ℹ️ No baseline improvements to update (counts are at or above current baselines).`,
    );
  }
  process.exit(0);
}

let regressions = 0;
let improvements = 0;
for (const result of results) {
  const delta = result.count - result.baseline;
  const mark = delta > 0 ? "✗" : "✓";
  if (delta > 0) regressions++;
  if (delta < 0 && result.baseline > 0) improvements++;
  console.log(
    `${mark} ${result.name}: ${result.count} (baseline ${result.baseline})  [${result.norm}]`,
  );
  if (delta < 0 && result.baseline > 0) {
    console.log(
      `   🎉 Improved by ${Math.abs(delta)}! Run with --update-baselines to ratchet down.`,
    );
  }
  if (delta > 0) {
    for (const site of result.sample) console.log(`      ${site}`);
  }
}

console.log("");
if (regressions > 0) {
  console.error(
    `💥 ${regressions} code-norm ratchet(s) regressed. Fix the new sites, or — only with a reviewed reason — lower the BASELINE in scripts/check-code-norms.mjs.`,
  );
  process.exit(1);
}
if (isRatchetMode && improvements > 0) {
  console.error(
    `⚠️ ${improvements} baseline(s) improved! Run 'node scripts/check-code-norms.mjs --update-baselines' to lock in improvements.`,
  );
  process.exit(1);
}
console.log(`✅ All code-norm ratchets held (scanned ${files.length} files).`);
