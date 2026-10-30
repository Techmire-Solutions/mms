import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Tests normally run with `apps/frontend` as cwd; tolerate a repo-root invocation.
const SRC_DIR = [
  path.join(process.cwd(), "src"),
  path.join(process.cwd(), "apps/frontend/src"),
].find((candidate) => fs.existsSync(candidate)) as string;
const SOURCE_EXT = /\.(ts|tsx)$/;
const HELPER_FILE = path.join(SRC_DIR, "lib", "apiContractError.ts");

/** Contract status guard (`status !== 200`, `status < 200`, `status >= 300`, …). */
const STATUS_GUARD = /\bstatus\s*(?:!==|<|>=|>)\s*\d{3}\b/;
/** Local duplicate of the shared `assertContractOk` helper. */
const LOCAL_HELPER = /(?:function|const)\s+(?:assertOk|assertSuccess|assertOkOrThrow)\s*[=(]/;
const THROW_WINDOW_LINES = 6;

interface Violation {
  file: string;
  line: number;
  reason: string;
  text: string;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      walk(full, out);
    } else if (SOURCE_EXT.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function isExcluded(file: string): boolean {
  if (file === HELPER_FILE) return true;
  if (/\.(test|spec)\.(ts|tsx)$/.test(file)) return true;
  return file.split(path.sep).includes("test");
}

describe("API contract error usage", () => {
  it("given the frontend source, should throw ApiError rather than generic Error on contract failures when scanned", () => {
    // Arrange
    const files = walk(SRC_DIR).filter((file) => !isExcluded(file));
    const violations: Violation[] = [];

    // Act
    for (const file of files) {
      const lines = fs.readFileSync(file, "utf8").split("\n");
      const rel = path.relative(SRC_DIR, file);
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] ?? "";
        if (LOCAL_HELPER.test(line)) {
          violations.push({
            file: rel,
            line: index + 1,
            reason: "local contract helper",
            text: line.trim(),
          });
        }
        if (!STATUS_GUARD.test(line)) continue;
        const window = lines.slice(index, index + THROW_WINDOW_LINES).join("\n");
        if (/throw new Error\(/.test(window)) {
          violations.push({
            file: rel,
            line: index + 1,
            reason: "generic Error thrown after a contract status guard",
            text: line.trim(),
          });
        }
      }
    }

    // Assert
    expect(
      violations.map(
        (violation) =>
          `${violation.file}:${violation.line} [${violation.reason}] ${violation.text}`,
      ),
    ).toEqual([]);
  });
});
