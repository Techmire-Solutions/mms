/**
 * Pure evaluator for the changed-file coverage gate.
 *
 * Kept separate from the CLI so the two failure modes can be unit-tested:
 *   1. changed source exists but no coverage was collected at all;
 *   2. a changed file (added or modified) has no coverage entry, or 0% coverage.
 *
 * Missing files contribute their line count to the denominator as 0% covered.
 * That is an approximation, but it stops a modified untested file from
 * contributing nothing — the hole the previous "modified files are exempt" rule
 * left open.
 */

/**
 * @param {{
 *   changed: string[],
 *   added: Set<string>,
 *   perFile: Map<string, { covered: number, total: number }>,
 *   min: number,
 *   minFileLines: number,
 *   lineCountOf: (file: string) => number,
 * }} input
 * @returns {{
 *   failures: string[],
 *   rows: Array<[string, string, string]>,
 *   aggregate: number,
 *   statementsTotal: number,
 * }}
 */
export function evaluateChangedCoverage({
  changed,
  added,
  perFile,
  min,
  minFileLines,
  lineCountOf,
}) {
  const failures = [];
  const rows = [];
  let coveredTotal = 0;
  let statementsTotal = 0;

  for (const file of changed) {
    const entry = perFile.get(file);
    if (!entry) {
      const lineCount = lineCountOf(file);
      rows.push([file, "no data", `${lineCount} lines`]);
      if (added.has(file) && lineCount >= minFileLines) {
        failures.push(
          `${file}: new file not imported by any executed test (${lineCount} lines, 0% covered)`,
        );
      }
      // Count it as uncovered so a modified untested file cannot vanish from the
      // aggregate. Tiny shims stay cheap.
      statementsTotal += Math.max(0, lineCount);
      continue;
    }

    coveredTotal += entry.covered;
    statementsTotal += entry.total;
    const percent = (entry.covered / entry.total) * 100;
    rows.push([file, `${percent.toFixed(0)}%`, `${entry.covered}/${entry.total}`]);
    if (entry.covered === 0 && entry.total >= minFileLines) {
      failures.push(`${file}: 0% line coverage across ${entry.total} statements`);
    }
  }

  const aggregate = statementsTotal > 0 ? (coveredTotal / statementsTotal) * 100 : 100;

  const anyChangedFileCovered = changed.some((file) => perFile.has(file));
  if (changed.length > 0 && !anyChangedFileCovered) {
    failures.push(
      `no coverage data was collected for ${changed.length} changed source file(s) — ` +
        "the coverage report is missing or empty",
    );
  }
  if (aggregate < min) {
    failures.push(`aggregate changed-file coverage ${aggregate.toFixed(1)}% < ${min}%`);
  }

  return { failures, rows, aggregate, statementsTotal };
}
