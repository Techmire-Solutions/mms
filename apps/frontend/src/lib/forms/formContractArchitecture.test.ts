import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Static guard for the form contract.
 *
 * The runtime half lives in `useFormSubmission`/`FormModal` (submit guard,
 * discard confirmation, await-before-close). These checks keep future forms from
 * quietly reintroducing the patterns this remediation removed.
 */

const roots = [join(process.cwd(), "src/tenant"), join(process.cwd(), "src/platform")];

function readSources(dir: string): Array<{ file: string; source: string }> {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".tsx") && !file.includes(".test."))
    .map((file) => ({
      file: file.replaceAll("\\", "/"),
      source: readFileSync(join(dir, file), "utf8"),
    }));
}

const sources = roots.flatMap(readSources);
const formSurfaces = sources.filter(({ source }) => /<FormModal[\s>]/.test(source));

describe("form contract architecture", () => {
  it("has form surfaces to audit", () => {
    expect(formSurfaces.length).toBeGreaterThan(40);
  });

  it("never fires a form save with a fire-and-forget mutate()", () => {
    const violations = formSurfaces.flatMap(({ file, source }) =>
      [...source.matchAll(/void\s+[\w.]*\.mutate\s*\(/g)].map((match) => `${file}: ${match[0]}`),
    );
    expect(violations).toEqual([]);
  });

  it("does not pass the removed `lang` prop to FormModal", () => {
    const violations = formSurfaces.flatMap(({ file, source }) => {
      const start = source.indexOf("<FormModal");
      const window = source.slice(start, start + 1200);
      return /lang=\{/.test(window) ? [file] : [];
    });
    expect(violations).toEqual([]);
  });

  it("keeps REST form surfaces off the legacy live-collection store", () => {
    const violations = formSurfaces
      .filter(({ source }) => /useLiveCollection|getCollection\(/.test(source))
      .map(({ file }) => file);
    expect(violations).toEqual([]);
  });
});
