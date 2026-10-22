/**
 * Finance fee structures: list, save (with fee items) and delete.
 */

import { and, eq } from "drizzle-orm";
import { isFeeFrequency, type FeeStructure } from "@mms/shared";
import { financeFeeItems, financeFeeStructures } from "../schema.js";
import { withTenant, withTenantRead } from "../tenant-context.js";
import { resolveFeeStructureClassRefsTx } from "./feeStructureClassRefs.js";
function feeStructureFromRows(
  structure: typeof financeFeeStructures.$inferSelect,
  items: Array<typeof financeFeeItems.$inferSelect>,
): FeeStructure {
  return {
    id: structure.id,
    name: structure.name,
    session: structure.session,
    className: structure.className,
    sessionId: structure.sessionId,
    classId: structure.classId,
    programId: structure.programId,
    frequency: isFeeFrequency(structure.frequency) ? structure.frequency : "monthly",
    isActive: structure.isActive,
    items: items
      .filter((item) => item.structureId === structure.id)
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((item) => ({
        id: item.id,
        name: item.name,
        incomeAccountId: item.incomeAccountId,
        amount: Number(item.amount),
        sortOrder: item.sortOrder,
      })),
    createdAt: structure.createdAt.toISOString(),
    updatedAt: structure.updatedAt.toISOString(),
  };
}
export async function listFeeStructures(tenant: string): Promise<FeeStructure[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const [structures, items] = await Promise.all([
      tx
        .select({
          id: financeFeeStructures.id,
          workspaceSubdomain: financeFeeStructures.workspaceSubdomain,
          name: financeFeeStructures.name,
          session: financeFeeStructures.session,
          className: financeFeeStructures.className,
          sessionId: financeFeeStructures.sessionId,
          classId: financeFeeStructures.classId,
          programId: financeFeeStructures.programId,
          frequency: financeFeeStructures.frequency,
          isActive: financeFeeStructures.isActive,
          createdAt: financeFeeStructures.createdAt,
          updatedAt: financeFeeStructures.updatedAt,
        })
        .from(financeFeeStructures)
        .where(eq(financeFeeStructures.workspaceSubdomain, subdomain)),
      tx
        .select({
          id: financeFeeItems.id,
          workspaceSubdomain: financeFeeItems.workspaceSubdomain,
          structureId: financeFeeItems.structureId,
          name: financeFeeItems.name,
          incomeAccountId: financeFeeItems.incomeAccountId,
          amount: financeFeeItems.amount,
          sortOrder: financeFeeItems.sortOrder,
          createdAt: financeFeeItems.createdAt,
        })
        .from(financeFeeItems)
        .where(eq(financeFeeItems.workspaceSubdomain, subdomain)),
    ]);
    return structures.map((structure) => feeStructureFromRows(structure, items));
  });
}
export async function saveFeeStructure(tenant: string, input: FeeStructure): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    const record = await resolveFeeStructureClassRefsTx(tx, subdomain, input);
    const fields = {
      name: record.name,
      session: record.session ?? "",
      className: record.className ?? "",
      sessionId: record.sessionId ?? null,
      classId: record.classId ?? null,
      programId: record.programId ?? null,
      frequency: record.frequency ?? "monthly",
      isActive: record.isActive ?? true,
      updatedAt: new Date(),
    };
    await tx
      .insert(financeFeeStructures)
      .values({ id: record.id, workspaceSubdomain: subdomain, ...fields })
      .onConflictDoUpdate({
        target: [financeFeeStructures.workspaceSubdomain, financeFeeStructures.id],
        set: fields,
      });
    await tx
      .delete(financeFeeItems)
      .where(
        and(
          eq(financeFeeItems.workspaceSubdomain, subdomain),
          eq(financeFeeItems.structureId, record.id),
        ),
      );
    if (record.items.length > 0) {
      await tx.insert(financeFeeItems).values(
        record.items.map((item, index) => ({
          id: item.id,
          workspaceSubdomain: subdomain,
          structureId: record.id,
          name: item.name,
          incomeAccountId: item.incomeAccountId ?? null,
          amount: String(item.amount ?? 0),
          sortOrder: item.sortOrder ?? index,
        })),
      );
    }
  });
}
export async function deleteFeeStructure(tenant: string, id: string): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx
      .delete(financeFeeStructures)
      .where(
        and(
          eq(financeFeeStructures.workspaceSubdomain, subdomain),
          eq(financeFeeStructures.id, id),
        ),
      );
  });
}
