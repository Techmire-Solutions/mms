import { and, eq, isNull, sql } from "drizzle-orm";
import { formatDeterministicEmployeeId, DEFAULT_FACULTY_SETTINGS } from "@mms/contracts";
import { facultyEmployments, facultySetupConfig } from "@mms/db/schema/faculty";
import { withTenant, type TenantTransaction } from "@mms/db/context";
import type { NextEmployeeIdResult } from "./facultyEmployeeIdService.js";
import { workspaceTodayIso } from "@mms/be-core/datetime";

/**
 * Atomically generates the next faculty employee ID using SELECT ... FOR UPDATE on faculty_setup_config.
 * Handles annual rollover: when the year changes, sequence resets to 1.
 */
export async function generateNextFacultyEmployeeId(
  tenant: string,
  txClient?: TenantTransaction,
): Promise<NextEmployeeIdResult> {
  const subdomain = tenant.trim().toLowerCase();
  const currentYear = Number((await workspaceTodayIso(subdomain)).slice(0, 4));

  const executeAtomicIncrement = async (tx: TenantTransaction): Promise<NextEmployeeIdResult> => {
    if (!tx || typeof tx.select !== "function") {
      const year = currentYear;
      const employeeId = formatDeterministicEmployeeId(
        1,
        {
          prefix: DEFAULT_FACULTY_SETTINGS.employeeIdPrefix,
          yearFormat: "YYYY",
          sequenceDigits: 4,
          delimiter: "",
        },
        new Date(year, 0, 1),
      );
      return {
        employeeId,
        sequence: 1,
        year,
      };
    }

    const configProjection = {
      prefix: facultySetupConfig.prefix,
      yearFormat: facultySetupConfig.yearFormat,
      sequenceDigits: facultySetupConfig.sequenceDigits,
      delimiter: facultySetupConfig.delimiter,
      currentSequence: facultySetupConfig.currentSequence,
      lastYear: facultySetupConfig.lastYear,
    };

    // Lock existing row or insert default
    let [row] = await tx
      .select(configProjection)
      .from(facultySetupConfig)
      .where(eq(facultySetupConfig.workspaceSubdomain, subdomain))
      .for("update");

    if (!row) {
      await tx
        .insert(facultySetupConfig)
        .values({
          workspaceSubdomain: subdomain,
          prefix: DEFAULT_FACULTY_SETTINGS.employeeIdPrefix,
          yearFormat: DEFAULT_FACULTY_SETTINGS.employeeIdYearFormat,
          sequenceDigits: DEFAULT_FACULTY_SETTINGS.employeeIdSequenceDigits,
          delimiter: DEFAULT_FACULTY_SETTINGS.employeeIdDelimiter,
          currentSequence: 0,
          lastYear: currentYear,
          updatedAt: new Date(),
        })
        .onConflictDoNothing();

      [row] = await tx
        .select(configProjection)
        .from(facultySetupConfig)
        .where(eq(facultySetupConfig.workspaceSubdomain, subdomain))
        .for("update");
    }

    const prefix = row?.prefix ?? DEFAULT_FACULTY_SETTINGS.employeeIdPrefix;
    const yearFormat = (row?.yearFormat ?? DEFAULT_FACULTY_SETTINGS.employeeIdYearFormat) as
      "YYYY" | "YY" | "NONE";
    const sequenceDigits = row?.sequenceDigits ?? DEFAULT_FACULTY_SETTINGS.employeeIdSequenceDigits;
    const delimiter = row?.delimiter ?? DEFAULT_FACULTY_SETTINGS.employeeIdDelimiter;
    const lastYear = row?.lastYear ?? currentYear;
    const currentSequence = row?.currentSequence ?? 0;

    // Annual rollover: if current year != lastYear, reset sequence to 1
    let nextSeq: number;
    let yearToSave: number;

    if (lastYear !== currentYear) {
      nextSeq = 1;
      yearToSave = currentYear;
    } else {
      nextSeq = currentSequence + 1;
      yearToSave = currentYear;
    }

    const formatCandidate = (seq: number) =>
      formatDeterministicEmployeeId(
        seq,
        {
          prefix,
          yearFormat: yearFormat === "YY" ? "YY" : "YYYY",
          sequenceDigits,
          delimiter,
        },
        new Date(yearToSave, 0, 1),
      );

    let candidateId = formatCandidate(nextSeq);
    let attempts = 0;
    const maxAttempts = 1000;

    while (attempts < maxAttempts) {
      const existing = await tx
        .select({ id: facultyEmployments.id })
        .from(facultyEmployments)
        .where(
          and(
            eq(facultyEmployments.workspaceSubdomain, subdomain),
            isNull(facultyEmployments.deletedAt),
            sql`lower(trim(${facultyEmployments.employeeId})) = ${candidateId.trim().toLowerCase()}`,
          ),
        )
        .limit(1);

      if (existing.length === 0) {
        break;
      }
      nextSeq += 1;
      attempts += 1;
      candidateId = formatCandidate(nextSeq);
    }

    if (attempts >= maxAttempts) {
      throw new Error(
        `Unable to generate a unique employee ID after ${maxAttempts} attempts. Check the sequence configuration.`,
      );
    }

    await tx
      .update(facultySetupConfig)
      .set({
        currentSequence: nextSeq,
        lastYear: yearToSave,
        updatedAt: new Date(),
      })
      .where(eq(facultySetupConfig.workspaceSubdomain, subdomain));

    return {
      employeeId: candidateId,
      sequence: nextSeq,
      year: yearToSave,
    };
  };

  if (txClient) {
    return await executeAtomicIncrement(txClient);
  }
  return await withTenant(subdomain, executeAtomicIncrement);
}

export const generateNextEmployeeId = generateNextFacultyEmployeeId;
