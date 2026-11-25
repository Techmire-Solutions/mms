#!/usr/bin/env node
/**
 * Module-move codemod (frontend bundler-style and NodeNext-style packages).
 *
 * Moves a batch of modules and rewrites the import/export/dynamic-import
 * specifiers that follow the moves — in the `@/…` alias form or the relative
 * form, preserving whichever style the call site already used and the configured
 * module-specifier extension convention. Specifiers where neither the importer
 * nor the target moved are left byte-for-byte untouched, so a move never becomes
 * a repo-wide formatting diff.
 *
 * Usage:
 *   node scripts/codemod/move-modules.mjs <map.json> [options]
 *
 * Options:
 *   --src-root <dir>     Root whose files are parsed/rewritten (default: apps/tenant-web/src)
 *   --ext-suffix <none|js>
 *                        Specifier extension convention:
 *                          none  → bundler style, extensionless, `dir` for index  (frontend)
 *                          js    → NodeNext style, explicit `.js`, `dir/index.js` (packages/contracts)
 *   --dry-run            Report changes without moving/writing
 *   --no-format          Skip `prettier --write` on touched files
 *   --rewrite-only       Repoint specifiers per the map WITHOUT moving files
 *                        (map = { oldResolvedFile: newResolvedFile }); use to
 *                        retire a re-export shim and repoint its importers.
 *   --verbose            Print every rewritten specifier (old -> new)
 *   --allow-cross-root   Allow a map target outside `--src-root` (e.g.
 *                        apps/api/src → packages/modules/<slice>/src/backend).
 *                        Combined with a matching `--target-alias`, imports of the
 *                        moved files become package specifiers instead of
 *                        `../../packages/...` relative paths.
 *   --target-alias <spec>=<dir>
 *                        Rewrite imports of files under <dir> (repo-relative) to
 *                        `<spec>/<path-within-dir>` (index files collapse to
 *                        `<spec>`). Repeatable. Importers already inside <dir>
 *                        keep relative imports. Example:
 *                          --target-alias @mms/mod-contacts/backend=packages/modules/contacts/src/backend
 *   --retarget <file>=<packageSpec>
 *                        Rewrite every importer of <file> to the bare
 *                        <packageSpec> (a file whose implementation already lives
 *                        in a workspace package, e.g. a re-export shim such as
 *                        lib/logger.ts -> @mms/be-core/logger). Repeatable, and the
 *                        map argument becomes optional. Example:
 *                          --retarget apps/api/src/lib/logger.ts=@mms/be-core/logger
 *
 * Cross-root note: only `--src-root` files are rewritten. Run the tool again with
 * `--src-root <destination>` to normalise imports between the moved files.
 *
 * <map.json> maps repo-relative SOURCE paths to TARGET paths:
 *   { "apps/tenant-web/src/components/ui/PageHeader.tsx":
 *       "apps/tenant-web/src/components/app/PageHeader.tsx" }
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
  allowCrossRoot: false,
  verbose: false,
  srcRoot: "apps/tenant-web/src",
  extSuffix: "none",
  targetAlias: [],
  retarget: [],
};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--dry-run") opts.dryRun = true;
  else if (a === "--no-format") opts.noFormat = true;
  else if (a === "--rewrite-only") opts.rewriteOnly = true;
  else if (a === "--allow-cross-root") opts.allowCrossRoot = true;
  else if (a === "--verbose") opts.verbose = true;
  else if (a === "--src-root") opts.srcRoot = argv[++i];
  else if (a === "--ext-suffix") opts.extSuffix = argv[++i];
  else if (a === "--target-alias") opts.targetAlias.push(argv[++i] ?? "");
  else if (a === "--retarget") opts.retarget.push(argv[++i] ?? "");
  else if (a.startsWith("--")) {
    console.error(`Unknown flag: ${a}`);
    process.exit(1);
  } else positional.push(a);
}
if (positional.length > 1 || (positional.length === 0 && opts.retarget.length === 0)) {
  console.error(
    "Usage: node scripts/codemod/move-modules.mjs <map.json> [--src-root dir] [--ext-suffix none|js] " +
      "[--rewrite-only] [--allow-cross-root] [--target-alias spec=dir] [--retarget file=spec] " +
      "[--verbose] [--dry-run] [--no-format]",
  );
  process.exit(1);
}
if (!["none", "js"].includes(opts.extSuffix)) {
  console.error(`--ext-suffix must be "none" or "js" (got: ${opts.extSuffix})`);
  process.exit(1);
}

/** `--target-alias spec=dir` pairs, resolved to absolute directories. */
const TARGET_ALIASES = opts.targetAlias.map((raw) => {
  const separator = raw.indexOf("=");
  if (separator <= 0) {
    console.error(
      `--target-alias must look like "@mms/mod-x/backend=packages/modules/x/src/backend" (got: "${raw}")`,
    );
    process.exit(1);
  }
  const spec = raw.slice(0, separator);
  const dir = path.resolve(ROOT, raw.slice(separator + 1));
  if (!dir.startsWith(ROOT)) {
    console.error(`--target-alias directory escapes the repository: ${raw.slice(separator + 1)}`);
    process.exit(1);
  }
  return { spec, dir };
});
/**
 * `--retarget file=packageSpec` pairs. The file must exist (a typo fails loudly),
 * and the specifier must be a bare package entry (no `./`, `/index`, `.js`).
 */
const RETARGETS = opts.retarget.map((raw) => {
  const separator = raw.indexOf("=");
  if (separator <= 0) {
    console.error(
      `--retarget must look like "apps/api/src/lib/logger.ts=@mms/be-core/logger" (got: "${raw}")`,
    );
    process.exit(1);
  }
  const file = path.resolve(ROOT, raw.slice(0, separator));
  const spec = raw.slice(separator + 1);
  if (!file.startsWith(ROOT)) {
    console.error(`--retarget file escapes the repository: ${raw.slice(0, separator)}`);
    process.exit(1);
  }
  if (!fs.existsSync(file)) {
    console.error(`--retarget file does not exist: ${toRel(file)}`);
    process.exit(1);
  }
  if (!spec.startsWith("@mms/") && !spec.startsWith("@")) {
    console.error(`--retarget spec must be a package specifier (got: "${spec}")`);
    process.exit(1);
  }
  return { file, spec };
});

if (opts.targetAlias.length && !opts.allowCrossRoot) {
  console.warn(
    "--target-alias without --allow-cross-root: aliases still apply inside the source root.",
  );
}

const SRC_ROOT = path.resolve(ROOT, opts.srcRoot);
const EXT_SUFFIX = opts.extSuffix === "js" ? ".js" : "";

const rawMap = positional.length
  ? JSON.parse(fs.readFileSync(path.resolve(ROOT, positional[0]), "utf8"))
  : {};
const abs = (p) => path.resolve(ROOT, p);
const toRel = (p) => path.relative(ROOT, p).split(path.sep).join("/");

/** finalOf: original absolute path -> final absolute path. */
const finalOf = new Map();
let moved = 0;

for (const [src, dst] of Object.entries(rawMap)) {
  const srcAbs = abs(src);
  const dstAbs = abs(dst);
  if (!srcAbs.startsWith(SRC_ROOT)) throw new Error(`source outside ${opts.srcRoot}: ${src}`);
  if (!opts.allowCrossRoot && !dstAbs.startsWith(SRC_ROOT))
    throw new Error(
      `target outside ${opts.srcRoot}: ${dst} (pass --allow-cross-root for a cross-package move)`,
    );
  if (!dstAbs.startsWith(ROOT)) throw new Error(`target escapes the repository: ${dst}`);
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

const isInside = (child, parent) => child === parent || child.startsWith(parent + path.sep);

/** Build the import specifier string from `fromAbs` to `targetAbs`. */
function buildSpecifier(fromAbs, targetAbs, useAlias) {
  const stripExt = (p) => p.replace(/\.(tsx|ts|jsx|js)$/, "");
  const tidy = (p) => (EXT_SUFFIX === ".js" ? p : p.replace(/\/index$/, ""));
  // A declared alias wins for files under its directory, but never for importers
  // already inside that directory (they keep short relative imports).
  const alias = TARGET_ALIASES.find(
    ({ dir }) => isInside(targetAbs, dir) && !isInside(fromAbs, dir),
  );
  if (alias) {
    const within = stripExt(path.relative(alias.dir, targetAbs).split(path.sep).join("/"));
    const collapsed = within === "index" ? "" : within.replace(/\/index$/, "");
    return collapsed ? `${alias.spec}/${collapsed}` : alias.spec;
  }
  // `@/` is a src-root alias: only a file still inside the source root may keep
  // it. A moved importer (now under a package dir) must fall through to a
  // relative specifier, otherwise a cross-root move of two files that import
  // each other emits a broken `@/../../packages/...` path.
  if (useAlias && isInside(fromAbs, SRC_ROOT)) {
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
    // Preserve untouched specifiers byte-for-byte: rebuilding every specifier
    // normalises unrelated `.js`/extensionless choices and turns a move into a
    // repo-wide formatting diff. Only a moved importer or a moved target is rebuilt.
    // A retargeted file's implementation lives in a package: the import becomes the
    // bare package specifier regardless of whether either side moved.
    const retarget = RETARGETS.find((entry) => entry.file === resolvedOrig);
    if (retarget) {
      if (spec === retarget.spec) continue;
      replacements.push({
        start: node.getStart(sourceFile),
        end: node.getEnd(),
        from: spec,
        text: JSON.stringify(retarget.spec),
      });
      continue;
    }
    const importerMoved = finalAbs !== originalAbs;
    const targetMoved = finalTarget !== resolvedOrig;
    if (!importerMoved && !targetMoved) continue;
    const newSpec = buildSpecifier(finalAbs, finalTarget, spec.startsWith("@/"));
    if (newSpec === spec) continue;
    replacements.push({
      start: node.getStart(sourceFile),
      end: node.getEnd(),
      from: spec,
      text: JSON.stringify(newSpec),
    });
  }

  if (replacements.length && opts.verbose) {
    for (const r of replacements) {
      console.log(`  ${toRel(originalAbs)}: ${r.from} -> ${JSON.parse(r.text)}`);
    }
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
