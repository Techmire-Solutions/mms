import { eq } from "drizzle-orm";
import { DEFAULT_FACULTY_SETTINGS, type FacultyEmployeeIdSettings } from "@mms/shared";
import { facultySetupConfig, type FacultySetupConfigRow } from "../../db/schema/faculty.js";
import { withTenant, withTenantRead } from "../../db/tenant-context.js";

export type { NextEmployeeIdResult, EmployeeIdPreviewResult } from "./facultyEmployeeIdPreview.js";

/**
 * Retrieves the current employee ID setup config for a tenant, falling back to defaults if not found.
 */
export async function getFacultySetupConfig(tenant: string): Promise<FacultySetupConfigRow> {
  const subdomain = tenant.trim().toLowerCase();
  return await withTenantRead(subdomain, async (tx) => {
    const currentYear = new Date().getFullYear();
    const fallbackRow: FacultySetupConfigRow = {
      workspaceSubdomain: subdomain,
      prefix: DEFAULT_FACULTY_SETTINGS.employeeIdPrefix ?? "FAC",
      yearFormat: DEFAULT_FACULTY_SETTINGS.employeeIdYearFormat ?? "YYYY",
      sequenceDigits: DEFAULT_FACULTY_SETTINGS.employeeIdSequenceDigits ?? 4,
      delimiter: DEFAULT_FACULTY_SETTINGS.employeeIdDelimiter ?? "",
      currentSequence: DEFAULT_FACULTY_SETTINGS.employeeIdCurrentSequence ?? 0,
      lastYear: DEFAULT_FACULTY_SETTINGS.employeeIdLastYear ?? currentYear,
      updatedAt: new Date(),
    };

    if (!tx || typeof tx.select !== "function") {
      return fallbackRow;
    }

    const [row] = await tx
      .select({
        workspaceSubdomain: facultySetupConfig.workspaceSubdomain,
        prefix: facultySetupConfig.prefix,
        yearFormat: facultySetupConfig.yearFormat,
        sequenceDigits: facultySetupConfig.sequenceDigits,
        delimiter: facultySetupConfig.delimiter,
        currentSequence: facultySetupConfig.currentSequence,
        lastYear: facultySetupConfig.lastYear,
        updatedAt: facultySetupConfig.updatedAt,
      })
      .from(facultySetupConfig)
      .where(eq(facultySetupConfig.workspaceSubdomain, subdomain));

    return row ?? fallbackRow;
  });
}

/**
 * Updates or creates the employee ID setup config for a tenant.
 */
export async function updateFacultySetupConfig(
  tenant: string,
  patch: Partial<FacultyEmployeeIdSettings>,
): Promise<FacultySetupConfigRow> {
  const subdomain = tenant.trim().toLowerCase();
  return await withTenant(subdomain, async (tx) => {
    const currentYear = new Date().getFullYear();
    if (!tx || typeof tx.select !== "function") {
      return {
        workspaceSubdomain: subdomain,
        prefix: patch.employeeIdPrefix ?? DEFAULT_FACULTY_SETTINGS.employeeIdPrefix ?? "FAC",
        yearFormat:
          patch.employeeIdYearFormat ?? DEFAULT_FACULTY_SETTINGS.employeeIdYearFormat ?? "YYYY",
        sequenceDigits:
          patch.employeeIdSequenceDigits ?? DEFAULT_FACULTY_SETTINGS.employeeIdSequenceDigits ?? 4,
        delimiter: patch.employeeIdDelimiter ?? DEFAULT_FACULTY_SETTINGS.employeeIdDelimiter ?? "",
        currentSequence:
          patch.employeeIdCurrentSequence ??
          DEFAULT_FACULTY_SETTINGS.employeeIdCurrentSequence ??
          0,
        lastYear: patch.employeeIdLastYear ?? currentYear,
        updatedAt: new Date(),
      };
    }

    const [existing] = await tx
      .select({
        prefix: facultySetupConfig.prefix,
        yearFormat: facultySetupConfig.yearFormat,
        sequenceDigits: facultySetupConfig.sequenceDigits,
        delimiter: facultySetupConfig.delimiter,
        currentSequence: facultySetupConfig.currentSequence,
        lastYear: facultySetupConfig.lastYear,
      })
      .from(facultySetupConfig)
      .where(eq(facultySetupConfig.workspaceSubdomain, subdomain))
      .for("update");

    const prefix =
      patch.employeeIdPrefix !== undefined
        ? patch.employeeIdPrefix.trim()
        : (existing?.prefix ?? DEFAULT_FACULTY_SETTINGS.employeeIdPrefix);

    const yearFormat =
      patch.employeeIdYearFormat !== undefined
        ? patch.employeeIdYearFormat
        : (existing?.yearFormat ?? DEFAULT_FACULTY_SETTINGS.employeeIdYearFormat);

    const sequenceDigits =
      patch.employeeIdSequenceDigits !== undefined
        ? Number(patch.employeeIdSequenceDigits)
        : (existing?.sequenceDigits ?? DEFAULT_FACULTY_SETTINGS.employeeIdSequenceDigits);

    const delimiter =
      patch.employeeIdDelimiter !== undefined
        ? patch.employeeIdDelimiter
        : (existing?.delimiter ?? DEFAULT_FACULTY_SETTINGS.employeeIdDelimiter);

    const currentSequence =
      patch.employeeIdCurrentSequence !== undefined
        ? Number(patch.employeeIdCurrentSequence)
        : (existing?.currentSequence ?? DEFAULT_FACULTY_SETTINGS.employeeIdCurrentSequence);

    const lastYear =
      patch.employeeIdLastYear !== undefined
        ? Number(patch.employeeIdLastYear)
        : (existing?.lastYear ?? currentYear);

    const values = {
      workspaceSubdomain: subdomain,
      prefix,
      yearFormat,
      sequenceDigits,
      delimiter,
      currentSequence,
      lastYear,
      updatedAt: new Date(),
    };

    const [saved] = await tx
      .insert(facultySetupConfig)
      .values(values)
      .onConflictDoUpdate({
        target: facultySetupConfig.workspaceSubdomain,
        set: {
          prefix: values.prefix,
          yearFormat: values.yearFormat,
          sequenceDigits: values.sequenceDigits,
          delimiter: values.delimiter,
          currentSequence: values.currentSequence,
          lastYear: values.lastYear,
          updatedAt: values.updatedAt,
        },
      })
      .returning();

    return saved;
  });
}

export { previewNextFacultyEmployeeId, previewNextEmployeeId } from "./facultyEmployeeIdPreview.js";

export {
  generateNextFacultyEmployeeId,
  generateNextEmployeeId,
} from "./facultyEmployeeIdGenerator.js";
