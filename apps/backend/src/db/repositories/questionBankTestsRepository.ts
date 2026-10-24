import { and, eq, inArray, isNull, isNotNull } from "drizzle-orm";
import { dedupeTrimmedIds, type QuestionBankTest } from "@mms/shared";
import { tests } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";
import { testRowToRecord } from "./questionBankTestsSync.js";
import { testSelectFields, fetchTestsChildrenTx } from "./questionBankTestsHydrate.js";

export { testRowToRecord } from "./questionBankTestsSync.js";
export * from "./questionBankTestsPersist.js";

export async function listTestsByWorkspace(
  tenant: string,
  options?: { limit?: number; offset?: number },
): Promise<QuestionBankTest[]> {
  const subdomain = tenant.trim().toLowerCase();
  const limit = Math.min(Math.max(options?.limit ?? 500, 1), 5000);
  const offset = Math.max(options?.offset ?? 0, 0);
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select(testSelectFields)
      .from(tests)
      .where(and(eq(tests.workspaceSubdomain, subdomain), isNull(tests.deletedAt)))
      .limit(limit)
      .offset(offset);
    if (rows.length === 0) return [];

    const tIds = rows.map((r) => r.id);
    const childrenMap = await fetchTestsChildrenTx(tx, subdomain, tIds);

    return rows.map((r) => {
      const children = childrenMap.get(r.id);
      return testRowToRecord(r, children?.testQs ?? [], children?.testSecs ?? []);
    });
  });
}

export async function findTestById(tenant: string, id: string): Promise<QuestionBankTest | null> {
  const cleanId = id?.trim();
  if (!cleanId) return null;
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select(testSelectFields)
      .from(tests)
      .where(and(eq(tests.workspaceSubdomain, subdomain), eq(tests.id, cleanId)))
      .limit(1);
    const row = rows[0];
    if (!row) return null;

    const childrenMap = await fetchTestsChildrenTx(tx, subdomain, [row.id]);
    const children = childrenMap.get(row.id);

    return testRowToRecord(row, children?.testQs ?? [], children?.testSecs ?? []);
  });
}

export async function findTestsByIds(
  tenant: string,
  ids: string[],
  options?: { deleted?: "active" | "deleted" | "all"; includeDeleted?: boolean },
): Promise<QuestionBankTest[]> {
  const cleanIds = dedupeTrimmedIds(ids);
  if (cleanIds.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const isDeletedOnly = options?.deleted === "deleted";
    const isAll = options?.deleted === "all";
    const deletedCond = isDeletedOnly
      ? isNotNull(tests.deletedAt)
      : isAll
        ? null
        : options?.includeDeleted
          ? isNotNull(tests.deletedAt)
          : isNull(tests.deletedAt);

    const conditions = [eq(tests.workspaceSubdomain, subdomain), inArray(tests.id, cleanIds)];
    if (deletedCond) conditions.push(deletedCond);

    const rows = await tx
      .select(testSelectFields)
      .from(tests)
      .where(and(...conditions));
    if (rows.length === 0) return [];

    const tIds = rows.map((r) => r.id);
    const childrenMap = await fetchTestsChildrenTx(tx, subdomain, tIds);

    return rows.map((r) => {
      const children = childrenMap.get(r.id);
      return testRowToRecord(r, children?.testQs ?? [], children?.testSecs ?? []);
    });
  });
}
