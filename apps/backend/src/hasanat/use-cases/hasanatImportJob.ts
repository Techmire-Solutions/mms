/**
 * `hasanat:import` background runner — the CSV/transfer import the UI has always advertised.
 *
 * Rows are resolved by **unique name** (`category` → denomination, `targetPerson` → student) and
 * written in bulk; every unresolvable or ambiguous row is reported individually instead of failing
 * the whole import. Tier evidence is reconciled once for all affected students.
 */

import {
  batchCardRequestId,
  cardValue,
  generateClientEntityId,
  normalizeHasanatModulePreferences,
  type HasanatTransferEntity,
} from "@mms/shared";
import { registerModuleCsvImportJobRunner } from "../../lib/registerModuleCsvImportJobRunner.js";
import { throwIfBackgroundJobAborted } from "../../lib/backgroundJobAbort.js";
import { withTenant } from "../../db/tenant-context.js";
import {
  findDistributionsByClientRequestIds,
  findStudentsByNames,
  hasanatRepository,
  insertBatchDistributions,
  listBatchesByWorkspace,
  listDenomsByWorkspace,
  type NewBatchCard,
} from "../repository/hasanatRepositoryAdapter.js";
import { assertAwardScope, resolveAwardScopeBypass } from "./hasanatAwardScope.js";
import { auditCardState } from "./hasanatAudit.js";
import { reconcileTiersForStudents } from "./hasanatTierUseCases.js";
import { resolveImportRows } from "./hasanatImportResolve.js";

export const HASANAT_IMPORT_JOB_KEY = "hasanat:import";

let registered = false;

export interface HasanatImportRunContext {
  tenant: string;
  userId: string;
  jobId: string;
  signal?: AbortSignal;
  updateProgress: (current: number, total: number) => Promise<void>;
}

export interface HasanatImportResult {
  imported: number;
  failed?: number;
  total: number;
  errors?: Array<{ row: number; reason: string }>;
}

/**
 * The import write itself. Exported so retry/idempotency behaviour is unit-testable without a queue:
 * rows already committed by an earlier attempt are skipped, never re-inserted.
 */
export async function importHasanatRows(
  rows: HasanatTransferEntity[],
  ctx: HasanatImportRunContext,
): Promise<HasanatImportResult> {
  const tenant = ctx.tenant.trim().toLowerCase();
  const total = rows.length;
  if (total === 0) return { imported: 0, total: 0 };

  const [denominations, batches] = await Promise.all([
    listDenomsByWorkspace(tenant),
    listBatchesByWorkspace(tenant),
  ]);

  const names = rows.map((row) => row.targetPerson?.trim() ?? "").filter(Boolean);
  const studentRows = await findStudentsByNames(tenant, names);
  const studentsByName = new Map<string, Array<{ studentId: string; studentName: string }>>();
  for (const student of studentRows) {
    const key = student.studentName.trim().toLowerCase();
    if (!key) continue;
    studentsByName.set(key, [...(studentsByName.get(key) ?? []), student]);
  }

  const fallbackDate = new Date().toISOString().slice(0, 10);
  const { resolved, errors } = resolveImportRows(
    rows,
    denominations,
    batches,
    studentsByName,
    fallbackDate,
  );

  if (resolved.length === 0) {
    return { imported: 0, total, errors };
  }

  await ctx.updateProgress(0, total);

  const cards: NewBatchCard[] = resolved.map(({ rowNumber, item }) => ({
    id: generateClientEntityId("hd"),
    studentId: item.studentId,
    studentName: item.studentName,
    classId: null,
    sessionId: null,
    batchId: item.batchId,
    denominationId: item.denomination.id,
    denominationName: item.denomination.name,
    quantity: 1,
    pointsSnapshot: cardValue(item.denomination.points, 1),
    clientRequestId: batchCardRequestId(`import:${ctx.jobId}:${rowNumber}`, item.studentId),
    expiresOn: null,
    reason: item.reason,
    issuedDate: item.issuedDate,
    issuedByUserId: ctx.userId,
    issuedBy: null,
  }));

  // A deploy/timeout must not start a write it cannot finish.
  throwIfBackgroundJobAborted(ctx.signal);

  // Retry/resume safety: rows this job already committed are skipped, never re-inserted.
  const existing = await findDistributionsByClientRequestIds(
    tenant,
    cards.map((card) => card.clientRequestId),
  );
  const existingKeys = new Set(existing.map((row) => row.clientRequestId));
  const pending = cards.filter((card) => !existingKeys.has(card.clientRequestId));

  // The CSV import is a write path like any other: instructor scope still applies.
  const rawPreferences = hasanatRepository.getModulePreferences
    ? await hasanatRepository.getModulePreferences(tenant)
    : null;
  await assertAwardScope({
    tenant,
    repo: hasanatRepository,
    actorUserId: ctx.userId,
    bypass: await resolveAwardScopeBypass(tenant, ctx.userId, hasanatRepository),
    awardScope: normalizeHasanatModulePreferences(rawPreferences).awardScope,
    classIds: [],
    studentIds: cards.map((card) => card.studentId),
  });

  let insertedIds: string[] = [];
  if (pending.length > 0) {
    insertedIds = await withTenant(tenant, async () => {
      const ids = await insertBatchDistributions(tenant, pending);
      const inserted = new Set(ids);
      // Audit only the rows this attempt actually committed (a conflict-skipped row was
      // audited by the attempt that inserted it).
      for (const card of pending) {
        if (!inserted.has(card.id)) continue;
        await auditCardState({
          tenant,
          actorUserId: ctx.userId,
          action: "CREATE",
          cardId: card.id,
          after: {
            studentId: card.studentId,
            classId: card.classId ?? null,
            sessionId: card.sessionId ?? null,
            batchId: card.batchId,
            denominationId: card.denominationId,
            quantity: card.quantity,
            pointsSnapshot: card.pointsSnapshot ?? null,
            status: "active",
            issuedDate: card.issuedDate,
            expiresOn: card.expiresOn ?? null,
          },
          reason: card.reason ?? null,
          tag: "hasanat.import",
        });
      }
      await reconcileTiersForStudents(
        tenant,
        Array.from(
          new Set(pending.filter((card) => inserted.has(card.id)).map((c) => c.studentId)),
        ),
        { actorUserId: ctx.userId },
      );
      return ids;
    });
  }

  throwIfBackgroundJobAborted(ctx.signal);
  await ctx.updateProgress(cards.length, total);

  return {
    imported: insertedIds.length,
    failed: cards.length - insertedIds.length,
    total,
    ...(errors.length > 0 ? { errors } : {}),
  };
}

/** Registers the `hasanat:import` runner once per process. */
export function registerHasanatImportRunner(): void {
  if (registered) return;
  registered = true;

  registerModuleCsvImportJobRunner<HasanatTransferEntity>({
    moduleId: "hasanat",
    entityNounPlural: "hasanat cards",
    importBatch: importHasanatRows,
  });
}
