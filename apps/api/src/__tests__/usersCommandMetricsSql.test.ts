import { describe, expect, it, vi } from "vitest";

const captured = vi.hoisted(() => ({ fields: null as Record<string, unknown> | null }));

vi.mock("@mms/db/context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/db/context")>()),

  withTenantRead: async (_tenant: string, callback: (tx: unknown) => Promise<unknown>) =>
    callback({
      select: (fields: Record<string, unknown>) => {
        captured.fields = fields;
        return {
          from: () => ({
            where: async () => [
              {
                total: 0,
                active: 0,
                suspended: 0,
                admins: 0,
                twoFaEnabled: 0,
                activeSessions: 0,
              },
            ],
          }),
        };
      },
    }),
}));

import { aggregateUsersCommandMetrics } from "../db/repositories/tenantUserRepositoryList.js";

describe("aggregateUsersCommandMetrics", () => {
  it("counts the provisioned apex admin as an admin in the SQL aggregate", async () => {
    await aggregateUsersCommandMetrics("demo");

    const admins = captured.fields?.admins as
      { getSQL?: () => { queryChunks?: unknown[] } } | undefined;
    expect(admins).toBeDefined();
    // Collect the literal text chunks from the drizzle SQL template.
    const chunks = admins?.getSQL?.().queryChunks ?? [];
    const sqlText = chunks
      .map((chunk) => {
        if (typeof chunk === "string") return chunk;
        const values = (chunk as { value?: unknown }).value;
        return Array.isArray(values) ? values.join(",") : String(values ?? "");
      })
      .join(" ");
    // The production predicate must include the apex roles, not just `admin`.
    expect(sqlText).toContain("admin");
    expect(sqlText).toContain("super_admin");
    expect(sqlText).toContain("super_user");
  });
});
