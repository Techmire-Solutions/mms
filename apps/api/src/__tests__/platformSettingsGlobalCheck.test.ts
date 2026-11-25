import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveMigrationsFolder } from "@mms/db/testing";

const migrationPath = join(resolveMigrationsFolder(), "0151_platform_settings_global_check.sql");

describe("platform_settings singleton CHECK", () => {
  it("given migration 0151, should constrain id to global", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("platform_settings_global_id_check");
    expect(sql).toContain(`"id" = 'global'`);
  });
});
