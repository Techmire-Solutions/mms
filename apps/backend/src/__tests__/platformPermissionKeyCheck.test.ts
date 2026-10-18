import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.resolve(
  __dirname,
  "../db/migrations_drizzle/0150_platform_permission_key_check.sql",
);

/** Must stay aligned with PLATFORM_ADMIN_PERMISSION_KEYS in @mms/shared. */
const EXPECTED_PERMISSION_KEYS = ["workspaces", "onboard", "settings", "admins", "system"] as const;

describe("platform_user_permissions permission_key CHECK", () => {
  it("given migration 0150, should constrain keys to PLATFORM_ADMIN_PERMISSION_KEYS", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("platform_user_perms_key_check");
    for (const key of EXPECTED_PERMISSION_KEYS) {
      expect(sql).toContain(`'${key}'`);
    }
  });
});
