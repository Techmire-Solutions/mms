/// <reference types="node" />
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { Linter } from "eslint";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const rule = require("../../eslint-rules/no-direct-api-client.cjs");

/**
 * Guards the raw-apiClient boundary rule. The rule lets modules import the `ApiError`
 * class but bans the `apiFetch`/`apiJson` transport unless the file is ratcheted in
 * direct-api-client-baseline.json — with a staleness check so the list only shrinks.
 *
 * The "baselined" cases read the current first baseline entry at runtime (rather than
 * hardcoding a path that a migration would remove), and skip when the baseline is empty.
 */
const baseline: string[] = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../../eslint-rules/direct-api-client-baseline.json"),
    "utf8",
  ),
);
const baselinedPath = baseline[0];

const linter = new Linter();

const config: Linter.Config[] = [
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module" },
    plugins: { "mms-boundary": { rules: { "no-direct-api-client": rule } } },
    rules: { "mms-boundary/no-direct-api-client": "error" },
  },
];

const RULE_ID = "mms-boundary/no-direct-api-client";

function lint(code: string, filename = "src/tenant/features/tasks/hooks/newThing.ts"): string[] {
  return linter
    .verify(code, config, filename)
    .filter((m) => m.ruleId === RULE_ID)
    .map((m) => m.message);
}

describe("no-direct-api-client", () => {
  it("flags an apiJson import in a non-baselined tenant file", () => {
    const found = lint(`import { apiJson } from "@/lib/apiClient";`);
    expect(found).toHaveLength(1);
    expect(found[0]).toContain("apiJson");
  });

  it("flags an apiFetch import pulled in alongside other symbols", () => {
    const found = lint(`import { apiFetch, resolveApiUrl } from "@/lib/apiClient";`);
    expect(found).toHaveLength(1);
    expect(found[0]).toContain("apiFetch");
  });

  it("flags a non-baselined platform file", () => {
    const found = lint(
      `import { apiJson } from "@/lib/apiClient";`,
      "src/platform/hooks/newThing.ts",
    );
    expect(found).toHaveLength(1);
    expect(found[0]).toContain("apiJson");
  });

  it("does not flag importing only the ApiError class", () => {
    expect(lint(`import { ApiError } from "@/lib/apiClient";`)).toEqual([]);
  });

  it("does not flag importing apiClient helpers (resolveApiUrl)", () => {
    expect(lint(`import { resolveApiUrl } from "@/lib/apiClient";`)).toEqual([]);
  });

  it("ignores test files", () => {
    expect(
      lint(`import { apiJson } from "@/lib/apiClient";`, "src/tenant/features/x/x.test.ts"),
    ).toEqual([]);
  });

  it.skipIf(!baselinedPath)("allows a baselined file until it is migrated", () => {
    expect(lint(`import { apiJson } from "@/lib/apiClient";`, baselinedPath)).toEqual([]);
  });

  it.skipIf(!baselinedPath)("reports a baselined file that no longer imports the transport as stale", () => {
    const found = lint(`export const noop = 1;`, baselinedPath);
    expect(found).toHaveLength(1);
    expect(found[0]).toContain("no longer imports");
  });
});
