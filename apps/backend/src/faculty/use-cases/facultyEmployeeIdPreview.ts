import { eq } from "drizzle-orm";
import { formatDeterministicEmployeeId, DEFAULT_FACULTY_SETTINGS } from "@mms/shared";
import { facultySetupConfig } from "../../db/schema/faculty.js";
import { withTenantRead } from "../../db/tenant-context.js";

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
  const currentYear = new Date().getFullYear();
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

      return formatPreview({
        prefix: row?.prefix ?? fallbackConfig.prefix,
        yearFormat: (row?.yearFormat ?? fallbackConfig.yearFormat) as "YYYY" | "YY" | "NONE",
        sequenceDigits: row?.sequenceDigits ?? fallbackConfig.sequenceDigits,
        delimiter: row?.delimiter ?? fallbackConfig.delimiter,
        currentSequence: row?.currentSequence ?? fallbackConfig.currentSequence,
        lastYear: row?.lastYear ?? currentYear,
      });
    });
  } catch {
    // Table missing / transient DB errors — still return a deterministic preview.
    return formatPreview(fallbackConfig);
  }
}

export const previewNextEmployeeId = previewNextFacultyEmployeeId;
