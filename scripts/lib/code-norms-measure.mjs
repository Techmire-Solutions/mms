/**
 * Per-file measurements behind scripts/check-code-norms.mjs, shared by the
 * full-tree scan and the `--changed` per-file comparison.
 */

export const SCAN_DIRS = ["apps/frontend/src", "apps/backend/src", "packages/shared/src"];
export const IGNORED = /(^|\/)(node_modules|dist|coverage|\.turbo)\//;
export const SOURCE_EXT = /\.(ts|tsx)$/;
export const TEST_FILE = /\.(test|spec)\.(ts|tsx)$/;
/** The hard ceiling from mms-structure-naming.md §3. */
export const HARD_LIMIT = 300;
/** 6-digit hex literals; design tokens live in index.css `@theme`. */
const HEX_COLOUR = /#[0-9a-fA-F]{6}\b/;
/**
 * Tailwind arbitrary-colour bracket expressions:
 *   text-[#abc], bg-[rgb(...)], border-[hsl(...)] etc.
 * Zero are allowed — use semantic tokens from index.css @theme instead.
 */
const ARBITRARY_COLOUR = /\[#[0-9a-fA-F]|\[rgb[a]?\(|\[hsl[a]?\(/;
/** `any` annotations, but not the words "any" in prose. */
const ANY_ANNOTATION = /:\s*any\b|<any>|\bas\s+any\b/;

/**
 * Inert `@theme` tokens: v3 config names Tailwind v4 accepts silently but emits
 * no utility for. See the full rationale in scripts/check-code-norms.mjs.
 */
const INERT_THEME_NAMESPACES = [
  { prefix: "--font-size-", use: "--text-" },
  { prefix: "--line-height-", use: "--leading-" },
  { prefix: "--letter-spacing-", use: "--tracking-" },
  { prefix: "--box-shadow-", use: "--shadow-" },
  { prefix: "--border-radius-", use: "--radius-" },
];

const isComment = (line) => line.trimStart().startsWith("//") || line.trimStart().startsWith("*");

/** True when `rel` is a .ts/.tsx file the ratchet scans. */
export function isScannedSource(rel) {
  return (
    SOURCE_EXT.test(rel) &&
    !IGNORED.test(`${rel}/`) &&
    SCAN_DIRS.some((dir) => rel.startsWith(`${dir}/`))
  );
}

/** True when `rel` is a CSS file the inert-token check scans. */
export function isScannedCss(rel) {
  return (
    rel.endsWith(".css") &&
    !IGNORED.test(`${rel}/`) &&
    SCAN_DIRS.some((dir) => rel.startsWith(`${dir}/`))
  );
}

/** Violations in one .ts/.tsx file; test files only count toward nothing. */
export function measureSource(rel, content) {
  const lines = content.split("\n");
  const result = { anySites: [], arbitrarySites: [], hasHex: false, lineCount: lines.length };
  if (TEST_FILE.test(rel)) return result;
  lines.forEach((line, index) => {
    if (isComment(line)) return;
    if (ANY_ANNOTATION.test(line)) result.anySites.push(`${rel}:${index + 1}`);
    if (ARBITRARY_COLOUR.test(line)) result.arbitrarySites.push(`${rel}:${index + 1}`);
  });
  result.hasHex = HEX_COLOUR.test(content);
  return result;
}

/** Inert `@theme` token declarations in one CSS file. */
export function measureCss(rel, content) {
  const sites = [];
  content.split("\n").forEach((line, index) => {
    const declaration = /^\s*(--[a-z0-9-]+)\s*:/.exec(line);
    if (!declaration) return;
    for (const { prefix, use } of INERT_THEME_NAMESPACES) {
      if (declaration[1].startsWith(prefix)) {
        sites.push(
          `${rel}:${index + 1}  ${declaration[1]} declares no utility — use ${use}* instead`,
        );
      }
    }
  });
  return sites;
}
