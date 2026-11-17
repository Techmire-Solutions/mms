import { and, eq, isNull, sql } from "drizzle-orm";
import { formatDeterministicEmployeeId, DEFAULT_FACULTY_SETTINGS } from "@mms/shared";
import { facultyEmployments, facultySetupConfig } from "../../db/schema/faculty.js";
import { withTenantRead } from "../../db/tenant-context.js";
import { logger } from "../../lib/logger.js";
import { workspaceTodayIso } from "../../lib/workspaceDay.js";

export interface NextEmployeeIdResult {
  employeeId: string;
  sequence: number;
  year: number;
}

export interface EmployeeIdPreviewResult {
  nextEmployeeId: string;
  config: {
    prefix: string;
    yearFormat: "YYYY" | "YY" | "NONE";
    sequenceDigits: number;
    delimiter: string;
    currentSequence: number;
    lastYear: number;
  };
}

/**
 * Previews the next employee ID without incrementing the sequence in the database.
 */
export async function previewNextFacultyEmployeeId(
  tenant: string,
): Promise<EmployeeIdPreviewResult> {
  const subdomain = tenant.trim().toLowerCase();
  const currentYear = Number((await workspaceTodayIso(subdomain)).slice(0, 4));
  const fallbackConfig = {
    prefix: DEFAULT_FACULTY_SETTINGS.employeeIdPrefix ?? "FAC",
    yearFormat: (DEFAULT_FACULTY_SETTINGS.employeeIdYearFormat ?? "YYYY") as "YYYY" | "YY" | "NONE",
    sequenceDigits: DEFAULT_FACULTY_SETTINGS.employeeIdSequenceDigits ?? 4,
    delimiter: DEFAULT_FACULTY_SETTINGS.employeeIdDelimiter ?? "",
    currentSequence: DEFAULT_FACULTY_SETTINGS.employeeIdCurrentSequence ?? 0,
    lastYear: currentYear,
  };

  const formatPreview = (config: typeof fallbackConfig): EmployeeIdPreviewResult => {
    const nextSeq = config.lastYear !== currentYear ? 1 : (config.currentSequence ?? 0) + 1;
    const yearToUse = config.lastYear !== currentYear ? currentYear : config.lastYear;
    const nextEmployeeId = formatDeterministicEmployeeId(
      nextSeq,
      {
        prefix: config.prefix,
        yearFormat: config.yearFormat === "YY" ? "YY" : "YYYY",
        sequenceDigits: config.sequenceDigits,
        delimiter: config.delimiter,
      },
      new Date(yearToUse, 0, 1),
    );
    return { nextEmployeeId, config };
  };

  try {
    return await withTenantRead(subdomain, async (tx) => {
      if (!tx || typeof tx.select !== "function") {
        return formatPreview(fallbackConfig);
      }

      const [row] = await tx
        .select({
          prefix: facultySetupConfig.prefix,
          yearFormat: facultySetupConfig.yearFormat,
          sequenceDigits: facultySetupConfig.sequenceDigits,
          delimiter: facultySetupConfig.delimiter,
          currentSequence: facultySetupConfig.currentSequence,
          lastYear: facultySetupConfig.lastYear,
        })
        .from(facultySetupConfig)
        .where(eq(facultySetupConfig.workspaceSubdomain, subdomain));

      const resolvedConfig = {
        prefix: row?.prefix ?? fallbackConfig.prefix,
        yearFormat: (row?.yearFormat ?? fallbackConfig.yearFormat) as "YYYY" | "YY" | "NONE",
        sequenceDigits: row?.sequenceDigits ?? fallbackConfig.sequenceDigits,
        delimiter: row?.delimiter ?? fallbackConfig.delimiter,
        currentSequence: row?.currentSequence ?? fallbackConfig.currentSequence,
        lastYear: row?.lastYear ?? currentYear,
      };

      let nextSeq =
        resolvedConfig.lastYear !== currentYear ? 1 : (resolvedConfig.currentSequence ?? 0) + 1;
      const yearToUse =
        resolvedConfig.lastYear !== currentYear ? currentYear : resolvedConfig.lastYear;

      const formatCandidate = (seq: number) =>
        formatDeterministicEmployeeId(
          seq,
          {
            prefix: resolvedConfig.prefix,
            yearFormat: resolvedConfig.yearFormat === "YY" ? "YY" : "YYYY",
            sequenceDigits: resolvedConfig.sequenceDigits,
            delimiter: resolvedConfig.delimiter,
          },
          new Date(yearToUse, 0, 1),
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

      return {
        nextEmployeeId: candidateId,
        config: resolvedConfig,
      };
    });
  } catch (error: unknown) {
    // Table missing / transient DB errors — still return a deterministic preview.
    logger.warn(
      { err: error, tenant: subdomain },
      "Faculty employee-id preview fell back to defaults",
    );
    return formatPreview(fallbackConfig);
  }
}

export const previewNextEmployeeId = previewNextFacultyEmployeeId;
