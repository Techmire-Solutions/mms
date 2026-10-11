/**
 * `check-code-norms.mjs --changed`: compares each changed file against its own
 * version at the change base and fails when any file got worse.
 *
 * Equivalent to the full-tree ratchet for regressions: the global counts are sums
 * of per-file counts, unchanged files contribute the same amount, so the total can
 * only rise if some changed file rose. Baseline lowering stays with the full scan.
 */
import { changeBase, changedFiles, readAtBase, readCurrent } from "./changed-files.mjs";
import {
  HARD_LIMIT,
  isScannedCss,
  isScannedSource,
  measureCss,
  measureSource,
} from "./code-norms-measure.mjs";

const EMPTY = { anySites: [], arbitrarySites: [], hasHex: false, lineCount: 0 };

function sourceRegressions(rel) {
  const current = readCurrent(rel);
  if (current === null) return [];
  const now = measureSource(rel, current);
  const previous = readAtBase(rel);
  const before = previous === null ? EMPTY : measureSource(rel, previous);
  const found = [];
  if (now.anySites.length > before.anySites.length) {
    found.push(
      `Explicit \`any\` (${before.anySites.length} → ${now.anySites.length}): ${now.anySites.slice(0, 3).join(", ")}`,
    );
  }
  if (now.arbitrarySites.length > before.arbitrarySites.length) {
    found.push(`Tailwind arbitrary colour: ${now.arbitrarySites.slice(0, 3).join(", ")}`);
  }
  if (now.hasHex && !before.hasHex) found.push(`Raw hex colour added to ${rel}`);
  const overNow = now.lineCount > HARD_LIMIT && !/\.(test|spec)\.(ts|tsx)$/.test(rel);
  if (overNow && before.lineCount <= HARD_LIMIT) {
    found.push(`${rel} grew past the ${HARD_LIMIT}-line hard ceiling (${now.lineCount} lines)`);
  }
  return found;
}

function cssRegressions(rel) {
  const current = readCurrent(rel);
  return current === null
    ? []
    : measureCss(rel, current).map((site) => `Inert @theme token: ${site}`);
}

/** Prints per-file regressions; returns the process exit code. */
export function runChangedCheck() {
  const files = changedFiles();
  const sources = files.filter(isScannedSource);
  const css = files.filter(isScannedCss);
  const regressions = [...sources.flatMap(sourceRegressions), ...css.flatMap(cssRegressions)];
  const scanned = sources.length + css.length;
  if (regressions.length > 0) {
    for (const regression of regressions) console.log(`✗ ${regression}`);
    console.error(
      `\n💥 ${regressions.length} code-norm regression(s) in changed files (vs ${changeBase.slice(0, 9)}). ` +
        "Fix the new sites — see scripts/check-code-norms.mjs for the norms.",
    );
    return 1;
  }
  console.log(
    `✅ No code-norm regressions in ${scanned} changed file(s) (vs ${changeBase.slice(0, 9)}).`,
  );
  return 0;
}
