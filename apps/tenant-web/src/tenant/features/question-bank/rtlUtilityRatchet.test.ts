import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The module is BiDi: a physical direction utility silently breaks every RTL locale. This ratchet
 * fails when a component adds `ml-/mr-/pl-/pr-*` or `text-left/text-right` instead of the logical
 * `ms-/me-/ps-/pe-/start-/end-/text-start/text-end` equivalents.
 */
const PHYSICAL_DIRECTION = /(?:^|[\s"'`])(?:ml|mr|pl|pr)-(?:\d|auto|px)|text-(?:left|right)\b/;

function collectTsx(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return collectTsx(full);
    return full.endsWith(".tsx") && !full.endsWith(".test.tsx") ? [full] : [];
  });
}

describe("Question Bank RTL utility ratchet", () => {
  it("uses logical direction utilities only", () => {
    const featureRoot = path.resolve(import.meta.dirname);
    const offenders = collectTsx(featureRoot)
      .map((file) => ({
        file: path.relative(featureRoot, file),
        matches: readFileSync(file, "utf-8")
          .split("\n")
          .map((line, index) => ({ line, number: index + 1 }))
          .filter(({ line }) => PHYSICAL_DIRECTION.test(line)),
      }))
      .filter((entry) => entry.matches.length > 0);

    expect(offenders).toEqual([]);
  });
});
