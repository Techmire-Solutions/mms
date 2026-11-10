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
  type Denomination,
  type HasanatTransferEntity,
} from "@mms/shared";
import { registerModuleCsvImportJobRunner } from "../../lib/registerModuleCsvImportJobRunner.js";
import { withTenant } from "../../db/tenant-context.js";
import {
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

export const HASANAT_IMPORT_JOB_KEY = "hasanat:import";

let registered = false;

interface ImportResolution {
  denomination: Denomination;
  studentId: string;
  studentName: string;
  batchId: string;
  issuedDate: string;
  reason: string;
}

/**
 * Resolves every row up front; rows that cannot be resolved unambiguously are reported and skipped.
 * Batch availability is tracked locally so one import cannot over-allocate a batch.
 */
function resolveImportRows(
  rows: readonly HasanatTransferEntity[],
  denominations: readonly Denomination[],
  batches: readonly { id: string; denominationId: string; remaining: number }[],
  studentsByName: ReadonlyMap<string, Array<{ studentId: string; studentName: string }>>,
  fallbackDate: string,
): {
  resolved: Array<{ rowNumber: number; item: ImportResolution }>;
  errors: Array<{ row: number; reason: string }>;
} {
  const denomsByName = new Map<string, Denomination[]>();
  for (const denom of denominations) {
    const key = denom.name.trim().toLowerCase();
    if (!key) continue;
    denomsByName.set(key, [...(denomsByName.get(key) ?? []), denom]);
  }

  const available = new Map<string, number>();
  for (const batch of batches) {
    available.set(
      batch.denominationId,
      (available.get(batch.denominationId) ?? 0) + batch.remaining,
    );
  }

  const resolved: Array<{ rowNumber: number; item: ImportResolution }> = [];
  const errors: Array<{ row: number; reason: string }> = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 1;
    const category = row.category?.trim().toLowerCase() ?? "";
    const person = row.targetPerson?.trim().toLowerCase() ?? "";

    const matches = category ? (denomsByName.get(category) ?? []) : [];
    if (matches.length === 0) {
      errors.push({ row: rowNumber, reason: `Unknown denomination "${row.category ?? ""}"` });
      return;
    }
    if (matches.length > 1) {
      errors.push({
        row: rowNumber,
        reason: `Ambiguous denomination "${row.category}" (${matches.length} matches)`,
      });
      return;
    }
    const denomination = matches[0];
    if (!denomination.active) {
      errors.push({ row: rowNumber, reason: `Denomination "${denomination.name}" is inactive` });
      return;
    }

    const students = person ? (studentsByName.get(person) ?? []) : [];
    if (students.length === 0) {
      errors.push({ row: rowNumber, reason: `Unknown student "${row.targetPerson ?? ""}"` });
      return;
    }
    if (students.length > 1) {
      errors.push({
        row: rowNumber,
        reason: `Ambiguous student "${row.targetPerson}" (${students.length} matches)`,
      });
      return;
    }

    const batch = batches.find((candidate) => candidate.denominationId === denomination.id);
    if (!batch) {
      errors.push({
        row: rowNumber,
        reason: `No stock batch exists for "${denomination.name}"`,
      });
      return;
    }
    if ((available.get(denomination.id) ?? 0) < 1) {
      errors.push({
        row: rowNumber,
        reason: `Batch for "${denomination.name}" has no remaining stock`,
      });
      return;
    }
    available.set(denomination.id, (available.get(denomination.id) ?? 0) - 1);

    resolved.push({
      rowNumber,
      item: {
        denomination,
        studentId: students[0].studentId,
        studentName: students[0].studentName,
        batchId: batch.id,
        issuedDate: row.date?.trim() || fallbackDate,
        reason:
          [row.title, row.description].filter(Boolean).join(" — ").slice(0, 1000) || "Imported",
      },
    });
  });

  return { resolved, errors };
}

/** Registers the `hasanat:import` runner once per process. */
export function registerHasanatImportRunner(): void {
  if (registered) return;
  registered = true;

  registerModuleCsvImportJobRunner<HasanatTransferEntity>({
    moduleId: "hasanat",
    entityNounPlural: "hasanat cards",
    importBatch: async (rows, ctx) => {
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

      await withTenant(tenant, async () => {
        await insertBatchDistributions(tenant, cards);
        // Per-record audit; the import's actor is the enqueuing user.
        for (const card of cards) {
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
          Array.from(new Set(cards.map((card) => card.studentId))),
          { actorUserId: ctx.userId },
        );
      });

      await ctx.updateProgress(cards.length, total);

      return {
        imported: cards.length,
        total,
        ...(errors.length > 0 ? { errors } : {}),
      };
    },
  });
}
