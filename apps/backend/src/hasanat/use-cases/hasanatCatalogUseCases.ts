/**
 * Point-catalogue writes: replace the list, then audit every changed row.
 *
 * Denominations/batches are the module's price list — a silent edit re-prices every future award —
 * so the wrappers diff before/after and append one audit row per changed record.
 */

import type { Denomination, StockBatch } from "@mms/shared";
import { getRequestTenant, getRequestUserId } from "../../lib/tenantContext.js";
import { auditSetupMutation } from "./hasanatAudit.js";
import type { HasanatRepository } from "../repository/hasanatRepository.js";

/** Point-catalogue snapshot (ids and amounts only). */
const denomAuditState = (row: Denomination): Record<string, unknown> => ({
  name: row.name,
  points: row.points,
  active: row.active,
});

const batchAuditState = (row: StockBatch): Record<string, unknown> => ({
  denominationId: row.denominationId,
  quantity: row.quantity,
  remaining: row.remaining ?? null,
  note: row.note ?? "",
});

interface ReplaceService<T> {
  replace: (records: T[]) => Promise<T[]>;
}

/** Fail closed: a catalogue write without a tenant must never reach the repository. */
function requireTenantFromContext(): string {
  const tenant = getRequestTenant();
  if (!tenant) throw new Error("Tenant context is required for a Hasanat setup write");
  return tenant;
}

export async function replaceDenomsWithAudit(
  repo: HasanatRepository,
  service: ReplaceService<Denomination>,
  records: Denomination[],
): Promise<Denomination[]> {
  const tenant = requireTenantFromContext();
  const before = await repo.listDenomsByWorkspace(tenant, { limit: 1000 });
  const after = await service.replace(records);
  const actorUserId = getRequestUserId();
  const beforeById = new Map(before.map((row) => [row.id, row]));
  const afterById = new Map(after.map((row) => [row.id, row]));
  for (const row of after) {
    const previous = beforeById.get(row.id);
    const changed =
      !previous ||
      previous.name !== row.name ||
      previous.points !== row.points ||
      previous.active !== row.active;
    if (!changed) continue;
    await auditSetupMutation({
      tenant,
      actorUserId,
      action: previous ? "UPDATE" : "CREATE",
      tableName: "hasanat_denoms",
      recordId: String(row.id),
      before: previous ? denomAuditState(previous) : null,
      after: denomAuditState(row),
      tag: "hasanat.denom.points",
    });
  }
  for (const previous of before) {
    if (afterById.has(previous.id)) continue;
    await auditSetupMutation({
      tenant,
      actorUserId,
      action: "DELETE",
      tableName: "hasanat_denoms",
      recordId: String(previous.id),
      before: denomAuditState(previous),
      after: { deleted: true },
      tag: "hasanat.denom.deleted",
    });
  }
  return after;
}

export async function replaceBatchesWithAudit(
  repo: HasanatRepository,
  service: ReplaceService<StockBatch>,
  records: StockBatch[],
): Promise<StockBatch[]> {
  const tenant = requireTenantFromContext();
  const before = await repo.listBatchesByWorkspace(tenant, { limit: 5000 });
  const after = await service.replace(records);
  const actorUserId = getRequestUserId();
  const beforeById = new Map(before.map((row) => [row.id, row]));
  const afterById = new Map(after.map((row) => [row.id, row]));
  for (const row of after) {
    const previous = beforeById.get(row.id);
    const changed =
      !previous ||
      previous.quantity !== row.quantity ||
      previous.denominationId !== row.denominationId ||
      (previous.note ?? "") !== (row.note ?? "");
    if (!changed) continue;
    await auditSetupMutation({
      tenant,
      actorUserId,
      action: previous ? "UPDATE" : "CREATE",
      tableName: "hasanat_batches",
      recordId: String(row.id),
      before: previous ? batchAuditState(previous) : null,
      after: batchAuditState(row),
      tag: "hasanat.batch.stock",
    });
  }
  for (const previous of before) {
    if (afterById.has(previous.id)) continue;
    await auditSetupMutation({
      tenant,
      actorUserId,
      action: "DELETE",
      tableName: "hasanat_batches",
      recordId: String(previous.id),
      before: batchAuditState(previous),
      after: { deleted: true },
      tag: "hasanat.batch.deleted",
    });
  }
  return after;
}
