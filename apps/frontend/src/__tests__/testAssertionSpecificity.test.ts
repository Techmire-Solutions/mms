import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Ratchet for assertion specificity (`mms-testing-observability` §1):
 * `toBeTruthy` / `toBeFalsy` / `toBeDefined` are banned on knowable values.
 *
 * The baseline can only go down. When assertions are tightened, lower the
 * constant in the same change; do not raise it to admit a new loose assertion.
 *
 * Measured 2026-10-30: 288 after deleting the attendance contract-hooks vanity
 * test (which asserted seven imports were `toBeDefined()`).
 */
const BASELINE = 288;
const LOOSE_ASSERTION = /\btoBeTruthy\(|\btoBeFalsy\(|\btoBeDefined\(/g;

// Tests run with `apps/frontend` as cwd; tolerate a repo-root invocation.
const SRC_DIR = [
  path.join(process.cwd(), "src"),
  path.join(process.cwd(), "apps/frontend/src"),
].find((candidate) => fs.existsSync(candidate)) as string;
const SELF = path.join(SRC_DIR, "__tests__", "testAssertionSpecificity.test.ts");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "test") continue;
      walk(full, out);
    } else if (/\.(test|spec)\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe("test assertion specificity", () => {
  it("given the frontend test suite, should not exceed the loose-assertion baseline when scanned", () => {
    // Arrange
    const files = walk(SRC_DIR).filter((file) => file !== SELF);
    const counts: Array<{ file: string; count: number }> = [];
    let total = 0;

    // Act
    for (const file of files) {
      const matches = fs.readFileSync(file, "utf8").match(LOOSE_ASSERTION);
      if (!matches) continue;
      total += matches.length;
      counts.push({ file: path.relative(SRC_DIR, file), count: matches.length });
    }

    // Assert
    const topOffenders = counts
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
      .map((entry) => `${entry.file} (${entry.count})`);
    expect(
      total,
      `Loose assertions must not grow (baseline ${BASELINE}). Tighten the listed ` +
        `assertions and lower BASELINE; do not raise it.\nTop offenders:\n${topOffenders.join("\n")}`,
    ).toBeLessThanOrEqual(BASELINE);
  });
});
