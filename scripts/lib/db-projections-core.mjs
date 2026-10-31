/**
 * Detection core for bare Drizzle projections (`db.select().from(t)`).
 *
 * The original scanner only matched `.select()` at end-of-line with `.from(` on
 * the next line, so the common one-line form (and a comment between the two
 * calls) escaped the zero-baseline ratchet.
 */

/** Removes comments while preserving line/column offsets and line numbers. */
export function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "))
    .replace(
      /(^|[^:])\/\/.*$/gm,
      (match, prefix) => prefix + " ".repeat(match.length - prefix.length),
    );
}

/**
 * Finds `.select()` with NO projection argument whose receiver chain continues
 * into `.from(` — on the same line or a later one, ignoring comments.
 *
 * @param {string} source
 * @returns {Array<{ line: number, code: string }>}
 */
export function findWildcardProjections(source) {
  const clean = stripComments(source);
  const lines = clean.split("\n");
  const hits = [];
  const pattern = /\.select\(\s*\)\s*(?:\r?\n\s*)?\.from\s*\(/g;

  for (const match of clean.matchAll(pattern)) {
    const line = clean.slice(0, match.index).split("\n").length;
    hits.push({ line, code: (lines[line - 1] ?? "").trim() });
  }
  return hits;
}
