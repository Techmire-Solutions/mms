import { readdirSync, readFileSync, statSync } from "node:fs";
import { vi } from "vitest";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveMigrationsFolder } from "@mms/db/testing";
vi.mock("../services/rbacService.js", (io: any) =>
  import("./helpers/authGuardMocks.js").then((m) => m.rbacServiceMock(io)),
);
vi.mock("../services/globalSettingsService.js", (io: any) =>
  import("./helpers/authGuardMocks.js").then((m) => m.globalSettingsServiceMock(io)),
);
vi.mock("../middleware/accountDeletionGuard.js", (io: any) =>
  import("./helpers/authGuardMocks.js").then((m) => m.accountDeletionGuardMock(io)),
);
vi.mock("@mms/be-core/audit", (io: any) =>
  import("./helpers/authGuardMocks.js").then((m) => m.auditMock(io)),
);

const ENROLLMENTS_MOD_BACKEND = join(
  process.cwd(),
  "../../packages/modules/enrollments/src/backend",
);

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return listFiles(full);
    return full.endsWith(".ts") && !full.endsWith(".test.ts") ? [full] : [];
  });
}

describe("enrollment tenant boundary (static guards)", () => {
  it("never bypasses RLS from a request path", () => {
    const requestPathFiles = [
      ...listFiles(join(ENROLLMENTS_MOD_BACKEND, "routes")),
      join(ENROLLMENTS_MOD_BACKEND, "tenant.router.ts"),
    ];
    const offenders = requestPathFiles.filter((file) =>
      readFileSync(file, "utf8").includes("withGlobalTenant"),
    );
    expect(offenders).toEqual([]);
  });

  it("keeps every enrollment table under FORCE ROW LEVEL SECURITY", () => {
    const migrationsDir = resolveMigrationsFolder();
    const sql = readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .map((file) => readFileSync(join(migrationsDir, file), "utf8"))
      .join("\n");
    for (const table of [
      "enrollments",
      "enrollment_placements",
      "enrollment_timeline_events",
      "registration_applications",
    ]) {
      const enable = new RegExp(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      const force = new RegExp(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
      expect(enable.test(sql), `${table} must enable RLS`).toBe(true);
      expect(force.test(sql), `${table} must force RLS`).toBe(true);
    }
  });

  it("binds the enrolments module access gate to the whole route plugin", () => {
    const routesIndex = readFileSync(join(process.cwd(), "src/routes/index.ts"), "utf8");
    expect(routesIndex).toContain('registerModuleAccess(scope, "enrollments")');
  });
});
