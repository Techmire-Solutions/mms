#!/usr/bin/env node
/**
 * Module-move codemod (frontend bundler-style and NodeNext-style packages).
 *
 * Moves a batch of modules and rewrites every import/export/dynamic-import
 * specifier under a source root so references follow the moves — in the `@/…`
 * alias form and the relative form, preserving whichever style the call site
 * already used, and preserving the module-specifier extension convention.
 *
 * Usage:
 *   node scripts/codemod/move-modules.mjs <map.json> [options]
 *
 * Options:
 *   --src-root <dir>     Root whose files are parsed/rewritten (default: apps/frontend/src)
 *   --ext-suffix <none|js>
 *                        Specifier extension convention:
 *                          none  → bundler style, extensionless, `dir` for index  (frontend)
 *                          js    → NodeNext style, explicit `.js`, `dir/index.js` (packages/shared)
 *   --dry-run            Report changes without moving/writing
 *   --no-format          Skip `prettier --write` on touched files
 *   --rewrite-only       Repoint specifiers per the map WITHOUT moving files
 *                        (map = { oldResolvedFile: newResolvedFile }); use to
 *                        retire a re-export shim and repoint its importers.
 *
 * <map.json> maps repo-relative SOURCE paths to TARGET paths:
 *   { "apps/frontend/src/components/ui/PageHeader.tsx":
 *       "apps/frontend/src/components/app/PageHeader.tsx" }
 *
 * Uses the classic TypeScript JS API (`typescript-v6`) because the installed
 * `typescript` v7 native build exposes no `createSourceFile`. No new deps.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript-v6");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const argv = process.argv.slice(2);
const positional = [];
const opts = {
  dryRun: false,
  noFormat: false,
  rewriteOnly: false,
  srcRoot: "apps/frontend/src",
  extSuffix: "none",
};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--dry-run") opts.dryRun = true;
  else if (a === "--no-format") opts.noFormat = true;
  else if (a === "--rewrite-only") opts.rewriteOnly = true;
  else if (a === "--src-root") opts.srcRoot = argv[++i];
  else if (a === "--ext-suffix") opts.extSuffix = argv[++i];
  else if (a.startsWith("--")) {
    console.error(`Unknown flag: ${a}`);
    process.exit(1);
  } else positional.push(a);
}
if (positional.length !== 1) {
  console.error(
    "Usage: node scripts/codemod/move-modules.mjs <map.json> [--src-root dir] [--ext-suffix none|js] [--dry-run] [--no-format]",
  );
  process.exit(1);
}
if (!["none", "js"].includes(opts.extSuffix)) {
  console.error(`--ext-suffix must be "none" or "js" (got: ${opts.extSuffix})`);
  process.exit(1);
}

const SRC_ROOT = path.resolve(ROOT, opts.srcRoot);
const EXT_SUFFIX = opts.extSuffix === "js" ? ".js" : "";

const rawMap = JSON.parse(fs.readFileSync(path.resolve(ROOT, positional[0]), "utf8"));
const abs = (p) => path.resolve(ROOT, p);
const toRel = (p) => path.relative(ROOT, p).split(path.sep).join("/");

/** finalOf: original absolute path -> final absolute path. */
const finalOf = new Map();
let moved = 0;

for (const [src, dst] of Object.entries(rawMap)) {
  const srcAbs = abs(src);
  const dstAbs = abs(dst);
  if (!srcAbs.startsWith(SRC_ROOT)) throw new Error(`source outside ${opts.srcRoot}: ${src}`);
  if (!dstAbs.startsWith(SRC_ROOT)) throw new Error(`target outside ${opts.srcRoot}: ${dst}`);
  if (!fs.existsSync(srcAbs)) throw new Error(`source does not exist: ${src}`);
  if (!opts.rewriteOnly && srcAbs !== dstAbs && fs.existsSync(dstAbs))
    throw new Error(`target already exists: ${dst}`);
  finalOf.set(srcAbs, dstAbs);
  if (srcAbs !== dstAbs) moved++;
}

const EXT_CANDIDATES = [".tsx", ".ts", ".jsx", ".js"];
const INDEX_CANDIDATES = EXT_CANDIDATES.map((e) => `index${e}`);

/** Resolve an alias/relative specifier to an absolute file path, or null. */
function resolveSpecifier(spec, importerAbs) {
  let base;
  if (spec.startsWith("@/")) base = path.join(SRC_ROOT, spec.slice(2));
  else if (spec.startsWith("./") || spec.startsWith("../"))
    base = path.resolve(path.dirname(importerAbs), spec);
  else return null;
  // NodeNext-style `.js` specifiers point at `.ts`/`.tsx` sources.
  const candidates = [base];
  if (/\.js$/.test(base)) candidates.push(base.slice(0, -3));
  for (const candidate of candidates) {
    for (const ext of EXT_CANDIDATES) if (fs.existsSync(candidate + ext)) return candidate + ext;
    for (const idx of INDEX_CANDIDATES) {
      const file = path.join(candidate, idx);
      if (fs.existsSync(file)) return file;
    }
  }
  return null;
}

/** Build the import specifier string from `fromAbs` to `targetAbs`. */
function buildSpecifier(fromAbs, targetAbs, useAlias) {
  const stripExt = (p) => p.replace(/\.(tsx|ts|jsx|js)$/, "");
  const tidy = (p) => (EXT_SUFFIX === ".js" ? p : p.replace(/\/index$/, ""));
  if (useAlias) {
    return (
      "@/" +
      tidy(stripExt(path.relative(SRC_ROOT, targetAbs).split(path.sep).join("/"))) +
      EXT_SUFFIX
    );
  }
  let rel = tidy(
    stripExt(path.relative(path.dirname(fromAbs), targetAbs).split(path.sep).join("/")),
  );
  if (!rel.startsWith(".")) rel = "./" + rel;
  return rel + EXT_SUFFIX;
}

/** Vitest/Jest mock factory functions whose first argument is a module path. */
const MOCK_FNS = new Set([
  "mock",
  "doMock",
  "unmock",
  "importActual",
  "importMock",
  "requireActual",
  "requireMock",
]);

/** Collect every module specifier string literal in a source file. */
function collectSpecifiers(sourceFile) {
  const nodes = [];
  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      nodes.push(node.moduleSpecifier);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      nodes.push(node.arguments[0]);
    } else if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      (node.expression.expression.text === "vi" || node.expression.expression.text === "jest") &&
      MOCK_FNS.has(node.expression.name.text) &&
      node.arguments.length >= 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      nodes.push(node.arguments[0]);
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    ) {
      nodes.push(node.argument.literal);
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);
  return nodes;
}

/** Walk the source root for .ts/.tsx, skipping generated dirs. */
function walkSourceFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "coverage")
      continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkSourceFiles(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const sourceFiles = walkSourceFiles(SRC_ROOT);
const edits = new Map(); // finalAbs -> content
const unresolved = [];

for (const originalAbs of sourceFiles) {
  // rewrite-only: never relocate the file being edited — the map only redirects
  // specifiers that resolve to a retired module onto its canonical target.
  const finalAbs = opts.rewriteOnly ? originalAbs : (finalOf.get(originalAbs) ?? originalAbs);
  const content = fs.readFileSync(originalAbs, "utf8");
  const sourceFile = ts.createSourceFile(
    originalAbs,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const replacements = [];

  for (const node of collectSpecifiers(sourceFile)) {
    const spec = node.text;
    const resolvedOrig = resolveSpecifier(spec, originalAbs);
    if (!resolvedOrig) {
      if (spec.startsWith("@/") || spec.startsWith("."))
        unresolved.push(`${toRel(originalAbs)} -> ${spec}`);
      continue;
    }
    const finalTarget = finalOf.get(resolvedOrig) ?? resolvedOrig;
    const newSpec = buildSpecifier(finalAbs, finalTarget, spec.startsWith("@/"));
    if (newSpec === spec) continue;
    replacements.push({
      start: node.getStart(sourceFile),
      end: node.getEnd(),
      text: JSON.stringify(newSpec),
    });
  }

  if (replacements.length) {
    let next = content;
    for (const r of replacements.sort((a, b) => b.start - a.start)) {
      next = next.slice(0, r.start) + r.text + next.slice(r.end);
    }
    edits.set(finalAbs, next);
  }
}

const touched = [...edits.keys()];
console.log(
  `[${opts.srcRoot} · ext=${opts.extSuffix}${opts.rewriteOnly ? " · rewrite-only" : ""}] ${Object.keys(rawMap).length} entries (${moved} real moves).`,
);
console.log(`Files whose imports change: ${touched.length}.`);
if (unresolved.length) {
  console.log(`\nUnresolved alias/relative specifiers (${unresolved.length}) — verify manually:`);
  for (const u of unresolved.slice(0, 40)) console.log(`  ${u}`);
}

if (opts.dryRun) {
  console.log("\n--dry-run: no files moved or written.");
  process.exit(0);
}

for (const [src, dst] of finalOf) {
  if (opts.rewriteOnly || src === dst) continue;
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  try {
    execFileSync("git", ["mv", toRel(src), toRel(dst)], { cwd: ROOT, stdio: "pipe" });
  } catch {
    fs.renameSync(src, dst); // untracked file
  }
}

for (const [finalAbs, content] of edits) fs.writeFileSync(finalAbs, content, "utf8");

console.log(`\nMoved ${moved} files; rewrote ${touched.length} files.`);

if (!opts.noFormat && touched.length) {
  const prettier = path.join(ROOT, "node_modules/.bin/prettier");
  if (fs.existsSync(prettier)) {
    try {
      execFileSync(prettier, ["--write", ...touched.map(toRel)], { cwd: ROOT, stdio: "inherit" });
    } catch {
      console.error("prettier failed — run it manually.");
    }
  }
}

console.log("\nDone. Next: build/typecheck + lint to confirm.");
