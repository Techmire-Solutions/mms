import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(process.cwd(), "src/platform");
const sources = readdirSync(root, { recursive: true, encoding: "utf8" })
  .filter((file) => file.endsWith(".tsx") && !file.includes(".test."))
  .map((file) => ({ file, source: readFileSync(join(root, file), "utf8") }));

describe("platform UI ownership", () => {
  it("routes native controls through the shared UI library", () => {
    const violations = sources.flatMap(({ file, source }) =>
      [...source.matchAll(/<(button|input|select|textarea|table|dialog)\b/g)].map(
        (match) => `${file}: <${match[1]}>`,
      ),
    );
    expect(violations).toEqual([]);
  });

  it("keeps each exported component implementation in one file", () => {
    const owners = new Map<string, string[]>();
    for (const { file, source } of sources) {
      for (const match of source.matchAll(
        /export\s+(?:default\s+)?(?:function|const)\s+([A-Z]\w*)/g,
      )) {
        owners.set(match[1], [...(owners.get(match[1]) ?? []), file]);
      }
    }
    expect([...owners.entries()].filter(([, files]) => files.length > 1)).toEqual([]);
  });

  it("keeps presentation colours in semantic tokens", () => {
    const violations = sources
      .filter(
        ({ file, source }) =>
          !file.endsWith("erd/ErdMermaidDiagram.tsx") &&
          /(?:bg|text|border|ring)-(?:red|blue|green|emerald|indigo|sky|violet|amber|gray|slate)-\d{2,3}\b/.test(
            source,
          ),
      )
      .map(({ file }) => file);
    expect(violations).toEqual([]);
  });

  it("prevents copied JSX blocks across platform components", () => {
    const owners = new Map<string, Set<string>>();
    for (const { file, source } of sources) {
      const lines = source
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("import"));
      for (let index = 0; index + 16 <= lines.length; index++) {
        const block = lines.slice(index, index + 16).join("\n");
        if ((block.match(/</g) ?? []).length < 3) continue;
        const files = owners.get(block) ?? new Set<string>();
        files.add(file);
        owners.set(block, files);
      }
    }
    expect(
      [...owners.values()].filter((files) => files.size > 1).map((files) => [...files]),
    ).toEqual([]);
  });
});
