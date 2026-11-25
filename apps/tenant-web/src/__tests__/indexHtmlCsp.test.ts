import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("index.html CSP compliance", () => {
  it("contains no inline event handler attributes (violating script-src-attr 'none')", () => {
    const indexPath = path.resolve(__dirname, "../../index.html");
    const content = fs.readFileSync(indexPath, "utf-8");

    // Match inline HTML event handler attributes: on<event>="..." or on<event>='...'
    const inlineHandlerRegex = /\s(on[a-z]+)\s*=\s*["'][^"']*["']/gi;
    const matches: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = inlineHandlerRegex.exec(content)) !== null) {
      matches.push(match[0].trim());
    }

    expect(matches).toEqual([]);
  });
});
