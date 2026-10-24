import { and, eq, sql } from "drizzle-orm";
import { formatTemplateSequence, type StudentGrNumberSettings } from "@mms/shared";
import { students, studentSequenceConfig } from "../schema.js";
import { withTenant, type TenantTransaction } from "../tenant-context.js";
import { enableIncludeDeleted } from "../../lib/softDeleteHelpers.js";

export interface GenerateGrNumberInput {
  regDate: string;
  settings: StudentGrNumberSettings;
}

/**
 * Concurrency-safe atomic batch GR number sequence generator.
 * Uses SELECT ... FOR UPDATE on student_sequence_config with annual rollover,
 * reserving `count` sequential numbers in a single atomic database transaction.
 */
export async function generateNextGrNumberBatchSql(
  tenant: string,
  count: number,
  input: GenerateGrNumberInput,
  txClient?: TenantTransaction,
): Promise<string[]> {
  if (count <= 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  const parsedYear = input.regDate ? new Date(input.regDate).getFullYear() : NaN;
  const year = Number.isFinite(parsedYear) ? parsedYear : new Date().getFullYear();
  const template = input.settings.grNumberTemplate || "{seq}-{year}";
  const digits = input.settings.grNumberDigits || 4;
  const restartAnnually = input.settings.grNumberRestartAnnually !== false;

  const execute = async (tx: TenantTransaction): Promise<string[]> => {
    let [row] = await tx
      .select({
        currentSequence: studentSequenceConfig.currentSequence,
        lastYear: studentSequenceConfig.lastYear,
      })
      .from(studentSequenceConfig)
      .where(eq(studentSequenceConfig.workspaceSubdomain, subdomain))
      .for("update");

    if (!row) {
      await enableIncludeDeleted(tx);
      const base = eq(students.workspaceSubdomain, subdomain);
      const yearStr = String(year);
      const countRows = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(students)
        .where(
          restartAnnually
            ? and(
                base,
                sql`(COALESCE(${students.registeredDate}::text, '') LIKE ${`${yearStr}%`} OR COALESCE(${students.grNumber}, '') LIKE ${`%${yearStr}%`})`,
              )
            : base,
        );
      const initialCount = Number(countRows[0]?.count ?? 0);

      await tx
        .insert(studentSequenceConfig)
        .values({
          workspaceSubdomain: subdomain,
          currentSequence: initialCount,
          lastYear: year,
          updatedAt: new Date(),
        })
        .onConflictDoNothing();

      [row] = await tx
        .select({
          currentSequence: studentSequenceConfig.currentSequence,
          lastYear: studentSequenceConfig.lastYear,
        })
        .from(studentSequenceConfig)
        .where(eq(studentSequenceConfig.workspaceSubdomain, subdomain))
        .for("update");
    }

    const lastYear = row?.lastYear ?? year;
    const currentSeq = row?.currentSequence ?? 0;

    let startSeq: number;
    let yearToSave: number;

    if (restartAnnually && lastYear !== year) {
      startSeq = 1;
      yearToSave = year;
    } else {
      startSeq = currentSeq + 1;
      yearToSave = year;
    }

    const endSeq = startSeq + count - 1;

    await tx
      .update(studentSequenceConfig)
      .set({
        currentSequence: endSeq,
        lastYear: yearToSave,
        updatedAt: new Date(),
      })
      .where(eq(studentSequenceConfig.workspaceSubdomain, subdomain));

    const results: string[] = [];
    for (let seq = startSeq; seq <= endSeq; seq++) {
      results.push(formatTemplateSequence(template, seq, digits, new Date(yearToSave, 0, 1)));
    }
    return results;
  };

  if (txClient) {
    return await execute(txClient);
  }
  return await withTenant(subdomain, execute);
}

/**
 * Pure read-only preview of next GR sequence without modifying or locking state.
 */
export async function previewNextGrNumberSql(
  tenant: string,
  input: GenerateGrNumberInput,
  txClient?: TenantTransaction,
): Promise<string> {
  const subdomain = tenant.trim().toLowerCase();
  const parsedYear = input.regDate ? new Date(input.regDate).getFullYear() : NaN;
  const year = Number.isFinite(parsedYear) ? parsedYear : new Date().getFullYear();
  const template = input.settings.grNumberTemplate || "{seq}-{year}";
  const digits = input.settings.grNumberDigits || 4;
  const restartAnnually = input.settings.grNumberRestartAnnually !== false;

  const execute = async (tx: TenantTransaction): Promise<string> => {
    const [row] = await tx
      .select({
        currentSequence: studentSequenceConfig.currentSequence,
        lastYear: studentSequenceConfig.lastYear,
      })
      .from(studentSequenceConfig)
      .where(eq(studentSequenceConfig.workspaceSubdomain, subdomain));

    let nextSeq: number;
    if (!row) {
      await enableIncludeDeleted(tx);
      const base = eq(students.workspaceSubdomain, subdomain);
      const yearStr = String(year);
      const countRows = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(students)
        .where(
          restartAnnually
            ? and(
                base,
                sql`(COALESCE(${students.registeredDate}::text, '') LIKE ${`${yearStr}%`} OR COALESCE(${students.grNumber}, '') LIKE ${`%${yearStr}%`})`,
              )
            : base,
        );
      const initialCount = Number(countRows[0]?.count ?? 0);
      nextSeq = initialCount + 1;
    } else {
      const lastYear = row.lastYear ?? year;
      const currentSeq = row.currentSequence ?? 0;
      nextSeq = restartAnnually && lastYear !== year ? 1 : currentSeq + 1;
    }

    return formatTemplateSequence(template, nextSeq, digits, new Date(year, 0, 1));
  };

  if (txClient) {
    return await execute(txClient);
  }
  return await withTenant(subdomain, execute, { readOnly: true });
}

/**
 * Concurrency-safe atomic single GR number sequence generator.
 */
export async function generateNextGrNumberSql(
  tenant: string,
  input: GenerateGrNumberInput,
  txClient?: TenantTransaction,
): Promise<string> {
  const [single] = await generateNextGrNumberBatchSql(tenant, 1, input, txClient);
  return single ?? "";
}
