import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(process.cwd(), "src");

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return listFiles(full);
    return full.endsWith(".ts") && !full.endsWith(".test.ts") ? [full] : [];
  });
}

function read(relative: string): string {
  return readFileSync(join(SRC, relative), "utf8");
}

describe("enrollment tenant boundary (static guards)", () => {
  it("never bypasses RLS from a request path", () => {
    const requestPathFiles = [
      ...listFiles(join(SRC, "routes")),
      ...listFiles(join(SRC, "enrollments")),
    ];
    const offenders = requestPathFiles.filter((file) =>
      readFileSync(file, "utf8").includes("withGlobalTenant"),
    );
    expect(offenders).toEqual([]);
  });

  it("keeps every enrollment table under FORCE ROW LEVEL SECURITY", () => {
    const migrationsDir = join(SRC, "db", "migrations_drizzle");
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
    expect(read("routes/tenant/enrollments.ts")).toContain(
      'registerModuleAccess(fastify, "enrollment")',
    );
  });
});
