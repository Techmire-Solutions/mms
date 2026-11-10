/**
 * CSV/transfer row resolution for the `hasanat:import` runner (pure: no DB, no side effects).
 *
 * Rows resolve by unique name (`category` → denomination, `targetPerson` → student); ambiguous or
 * unknown rows are reported individually and skipped. Batch availability is tracked locally so one
 * import cannot over-allocate a batch.
 */

import type { Denomination, HasanatTransferEntity } from "@mms/shared";

export interface ImportResolution {
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
/** `YYYY-MM-DD` that also round-trips as a real calendar day. */
function isIsoCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
}

export function resolveImportRows(
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
    // A `points` cell is advisory: the stamped value always comes from the denomination. Silently
    // ignoring a contradicting value made a "points import" look like it set points when it did not.
    const rawPoints = row.points == null ? "" : String(row.points).trim();
    const declaredPoints = rawPoints === "" ? null : Number(rawPoints);
    if (declaredPoints !== null && !Number.isFinite(declaredPoints)) {
      errors.push({ row: rowNumber, reason: `Invalid points value "${rawPoints}"` });
      return;
    }
    if (declaredPoints !== null && declaredPoints !== denomination.points) {
      errors.push({
        row: rowNumber,
        reason: `Points are defined by the denomination "${denomination.name}" (${denomination.points}); remove the points column or use a matching deed`,
      });
      return;
    }

    // Dates must be real ISO dates: a bad value would otherwise reach the insert and fail the
    // entire import instead of rejecting this row.
    const declaredDate = row.date?.trim() ?? "";
    if (declaredDate && !isIsoCalendarDate(declaredDate)) {
      errors.push({
        row: rowNumber,
        reason: `Invalid date "${declaredDate}" (expected YYYY-MM-DD)`,
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
        issuedDate: declaredDate || fallbackDate,
        reason:
          [row.title, row.description].filter(Boolean).join(" — ").slice(0, 1000) || "Imported",
      },
    });
  });

  return { resolved, errors };
}
