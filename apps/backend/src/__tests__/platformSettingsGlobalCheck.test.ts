import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.resolve(
  __dirname,
  "../db/migrations_drizzle/0151_platform_settings_global_check.sql",
);

describe("platform_settings singleton CHECK", () => {
  it("given migration 0151, should constrain id to global", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("platform_settings_global_id_check");
    expect(sql).toContain(`"id" = 'global'`);
  });
});
