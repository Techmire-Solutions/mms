import { createHash } from "node:crypto";
import { MAX_MARKS_OBTAINED, type Exam } from "@mms/shared";
import { toDbDate } from "../lib/dbDate.js";
import { throwIfBackgroundJobAborted } from "../lib/backgroundJobAbort.js";
import { registerModuleCsvImportJobRunner } from "../lib/registerModuleCsvImportJobRunner.js";
import { examinationsUseCases } from "../examinations/use-cases/examinationsUseCases.js";
import { examinationsRepository } from "../examinations/repository/examinationsRepositoryAdapter.js";

/**
 * Examinations CSV import.
 *
 * Rows map to exam records with a **deterministic id** derived from `name|subject|date`, so a
 * retried attempt or a replayed dead-letter upserts the same exam instead of creating a duplicate.
 * Rows are applied in chunks; a chunk that fails is retried row-by-row so the operator gets
 * per-row errors instead of an opaque batch failure.
 */

const STATUS_VALUES = new Set(["upcoming", "scheduled", "ongoing", "completed", "cancelled"]);

export interface ExaminationsImportRow {
  title?: string;
  subject?: string;
  examDate?: string;
  totalMarks?: string | number;
  passingMarks?: string | number;
  className?: string;
  status?: string;
  notes?: string;
}

const CHUNK_SIZE = 100;

function deterministicExamId(name: string, subject: string, date: string): string {
  const hash = createHash("sha1").update(`${name}|${subject}|${date}`).digest("hex");
  return `ex-${hash.slice(0, 24)}`;
}

function toNumber(value: string | number | undefined, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : Number.NaN;
}

/**
 * Maps one CSV row to an exam record, or explains why it cannot be imported.
 *
 * `className` is required and must resolve: an exam with no class has an empty roster and can
 * never be marked, which is exactly the unusable record the old metadata importer created.
 */
export function mapExaminationsImportRow(
  row: ExaminationsImportRow,
  classesByName: ReadonlyMap<string, string>,
): { record: Exam } | { error: string } {
  const name = String(row.title ?? "").trim();
  if (!name) return { error: "Exam title is required" };

  const date = toDbDate(row.examDate);
  if (!date) return { error: "Exam date must be a valid date (YYYY-MM-DD)" };

  const className = String(row.className ?? "").trim();
  if (!className) return { error: "A class is required (column: class)" };
  const classId = classesByName.get(className.toLowerCase());
  if (!classId) return { error: `Class "${className}" was not found in this workspace` };

  const totalMarks = toNumber(row.totalMarks, 100);
  const passingMarks = toNumber(row.passingMarks, 50);
  if (!Number.isFinite(totalMarks) || totalMarks <= 0) {
    return { error: "Total marks must be a positive number" };
  }
  if (totalMarks > MAX_MARKS_OBTAINED) {
    return { error: `Total marks cannot exceed ${MAX_MARKS_OBTAINED}` };
  }
  if (!Number.isFinite(passingMarks) || passingMarks < 0 || passingMarks > totalMarks) {
    return { error: "Passing marks must be between 0 and the total marks" };
  }

  const rawStatus = String(row.status ?? "")
    .trim()
    .toLowerCase();
  const status = (STATUS_VALUES.has(rawStatus) ? rawStatus : "scheduled") as Exam["status"];

  const subject = String(row.subject ?? "").trim();
  return {
    record: {
      id: deterministicExamId(name, subject, date),
      name,
      subject,
      totalMarks,
      passingMarks,
      date,
      duration: 60,
      classIds: [classId],
      status,
      description: String(row.notes ?? ""),
    },
  };
}

async function applyChunk(
  records: Exam[],
  startIndex: number,
  errors: Array<{ row: number; reason: string }>,
): Promise<number> {
  try {
    await examinationsUseCases.upsertExams(records);
    return records.length;
  } catch {
    // Attribute the failure: retry row-by-row so one bad row does not fail the whole chunk.
    let imported = 0;
    for (const [offset, record] of records.entries()) {
      try {
        await examinationsUseCases.upsertExams([record]);
        imported += 1;
      } catch (error) {
        errors.push({
          row: startIndex + offset + 1,
          reason: error instanceof Error ? error.message : "Failed to import this row",
        });
      }
    }
    return imported;
  }
}

export function registerExaminationsImportJobRunner(): void {
  registerModuleCsvImportJobRunner<ExaminationsImportRow>({
    moduleId: "examinations",
    entityNounPlural: "exams",
    importBatch: async (rows, ctx) => {
      const errors: Array<{ row: number; reason: string }> = [];
      let imported = 0;
      const classes = await examinationsRepository.listSessionClassNames(ctx.tenant);
      const classesByName = new Map(
        classes.map((entry) => [entry.name.trim().toLowerCase(), entry.id]),
      );

      for (let start = 0; start < rows.length; start += CHUNK_SIZE) {
        throwIfBackgroundJobAborted(ctx.signal);
        const slice = rows.slice(start, start + CHUNK_SIZE);
        const records: Exam[] = [];
        for (const [offset, row] of slice.entries()) {
          const mapped = mapExaminationsImportRow(row, classesByName);
          if ("error" in mapped) {
            errors.push({ row: start + offset + 1, reason: mapped.error });
            continue;
          }
          records.push(mapped.record);
        }
        imported += await applyChunk(records, start, errors);
        await ctx.updateProgress(Math.min(start + slice.length, rows.length), rows.length);
      }

      throwIfBackgroundJobAborted(ctx.signal);
      return {
        imported,
        failed: errors.length,
        total: rows.length,
        ...(errors.length > 0 ? { errors: errors.slice(0, 500) } : {}),
      };
    },
  });
}
