import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Static guards for the form contract.
 *
 * The runtime half lives in `useFormSubmission`/`FormModal` (submit guard,
 * discard confirmation, await-before-close). These checks keep future forms from
 * quietly reintroducing the patterns this remediation removed.
 *
 * The scan covers the shared `components/` tree as well as both consoles: branding,
 * reports and background-job surfaces own FormModal forms too, and scanning only
 * `tenant/` + `platform/` let them drift.
 */

const ROOTS = ["tenant", "platform", "components"];

interface FormSource {
  file: string;
  source: string;
}

const READABLE_EXEMPT_SOURCE = "scripts/lib/form-exemptions.mjs";

function readSources(root: string): FormSource[] {
  const dir = join(process.cwd(), "src", root);
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".tsx") && !file.includes(".test."))
    .map((file) => ({
      file: `${root}/${file.replaceAll("\\", "/")}`,
      source: readFileSync(join(dir, file), "utf8"),
    }));
}

export const SOURCES: FormSource[] = ROOTS.flatMap(readSources);

/** First `<FormModal` opening tag window — enough to see props, not children. */
function formModalWindow(source: string): string {
  const match = /<FormModal[\s>]/.exec(source);
  if (!match) return "";
  return source.slice(match.index, match.index + 2500);
}

const EDITABLE_DRAFT =
  /<(?:Input|Textarea|FormSelect|EditableSelect|DatePicker|TimePicker|DateTimePicker|ContactPicker|FormCollectionShell|Checkbox|FormSelectWithQuickCreate)\b/;

/** Pure rule set shared by the repo scan and the fixture tests. */
export function findContractViolations(sources: readonly FormSource[]): string[] {
  const violations: string[] = [];
  const formSurfaces = sources.filter(({ source }) => /<FormModal[\s>]/.test(source));

  for (const { file, source } of formSurfaces) {
    for (const match of source.matchAll(/void\s+[\w.]*\.mutate\s*\(/g)) {
      violations.push(`${file}: fire-and-forget save (${match[0]})`);
    }
    const window = formModalWindow(source);
    if (/lang=\{/.test(window)) violations.push(`${file}: removed \`lang\` prop on FormModal`);
    if (/useLiveCollection|getCollection\(/.test(source)) {
      violations.push(`${file}: REST form uses the legacy live-collection store`);
    }
  }
  return violations;
}

/** Pure dirty-guard rule: every editable FormModal write surface needs `isDirty`. */
export function findMissingDirtyGuards(
  sources: readonly FormSource[],
  exempt: ReadonlySet<string>,
): string[] {
  return sources
    .filter(({ file, source }) => {
      const window = formModalWindow(source);
      if (!window || !/\bonSave=/.test(window)) return false;
      if (!EDITABLE_DRAFT.test(source)) return false;
      if (/\bisDirty=/.test(window)) return false;
      return !exempt.has(file);
    })
    .map(({ file }) => file);
}

function readDirtyExemptions(): Set<string> {
  const source = readFileSync(join(process.cwd(), "..", "..", READABLE_EXEMPT_SOURCE), "utf8");
  const block = /export const DIRTY_EXEMPT = new Map\(\[([\s\S]*?)\]\);/.exec(source);
  if (!block) throw new Error("DIRTY_EXEMPT not found in scripts/lib/form-exemptions.mjs");
  return new Set([...block[1].matchAll(/\[\s*"([^"]+)"/g)].map((match) => match[1]));
}

const DIRTY_EXEMPT = readDirtyExemptions();

describe("form contract architecture", () => {
  it("has form surfaces to audit", () => {
    expect(SOURCES.filter(({ source }) => /<FormModal[\s>]/.test(source)).length).toBeGreaterThan(
      60,
    );
  });

  it("never fires a form save with a fire-and-forget mutate()", () => {
    expect(findContractViolations(SOURCES)).toEqual([]);
  });

  it("scans the shared components tree, not just the consoles", () => {
    expect(SOURCES.some(({ file }) => file.startsWith("components/"))).toBe(true);
    expect(SOURCES.some(({ file }) => file.startsWith("tenant/"))).toBe(true);
    expect(SOURCES.some(({ file }) => file.startsWith("platform/"))).toBe(true);
  });

  it("catches a fire-and-forget save in a shared components fixture", () => {
    const fixture = [
      {
        file: "components/branding/FixtureModal.tsx",
        source: "export const X = () => <FormModal open onSave={() => void save.mutate()} />;",
      },
    ];
    expect(findContractViolations(fixture)).toEqual([
      "components/branding/FixtureModal.tsx: fire-and-forget save (void save.mutate()",
    ]);
  });

  it("requires isDirty on every editable FormModal write surface", () => {
    expect(findMissingDirtyGuards(SOURCES, DIRTY_EXEMPT)).toEqual([]);
  });

  it("keeps declared dirty exemptions real and still unguarded", () => {
    for (const file of DIRTY_EXEMPT) {
      const entry = SOURCES.find((candidate) => candidate.file === file);
      expect(entry, `exempt file not found: ${file}`).toBeDefined();
      expect(/\bisDirty=/.test(formModalWindow(entry!.source)), `${file} now has isDirty`).toBe(
        false,
      );
    }
  });
});
