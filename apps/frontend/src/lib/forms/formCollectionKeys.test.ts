import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC_ROOT = resolve(process.cwd(), "src");
const INDEX_KEY_PATTERN = /key=\{(?:index|i|idx|rowIndex|optionIndex|sectionIndex)\}/;
const TEMPLATE_INDEX_KEY_PATTERN =
  /key=\{`[^`]*\$\{(?:index|i|idx|rowIndex|optionIndex|sectionIndex)\}/;
/**
 * Marker-derived blank rows have no add/remove/reorder operation, so their
 * position is the identity by design (documented in the component).
 */
const ALLOWLIST = new Set<string>([
  "tenant/features/question-bank/components/QuestionTypeAnswerFields.tsx",
]);

function tsxFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = join(directory, entry);
    if (statSync(fullPath).isDirectory()) return tsxFiles(fullPath);
    return entry.endsWith(".tsx") && !entry.endsWith(".test.tsx") ? [fullPath] : [];
  });
}

describe("form collection row keys", () => {
  it("never derives FormListFieldCard keys from the array index", () => {
    const offenders: string[] = [];

    for (const file of tsxFiles(SRC_ROOT)) {
      const source = readFileSync(file, "utf8");
      if (!source.includes("FormListFieldCard")) continue;
      const relativePath = relative(SRC_ROOT, file).replaceAll("\\", "/");
      if (ALLOWLIST.has(relativePath)) continue;
      if (INDEX_KEY_PATTERN.test(source) || TEMPLATE_INDEX_KEY_PATTERN.test(source)) {
        offenders.push(relativePath);
      }
    }

    expect(offenders).toEqual([]);
  });
});
