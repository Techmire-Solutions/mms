import {
  buildTenantExportFilename,
  facultyDepartmentsToCsv,
  facultyDesignationsToCsv,
  type FacultyDepartmentEntity,
} from "@mms/shared";
import { getRequestTenant } from "../lib/tenantContext.js";
import { listFacultyDepartments } from "../db/repositories/facultyDepartmentRepository.js";
import { listFacultyDesignations } from "../db/repositories/facultyDesignationRepository.js";

function resolveTenant(tenant?: string): string {
  const subdomain = (tenant ?? getRequestTenant() ?? "").trim().toLowerCase();
  if (!subdomain) throw new Error("Tenant context required for faculty catalog export");
  return subdomain;
}

/** Buffered CSV export of all active faculty departments. */
export async function buildFacultyDepartmentsCsvExport(
  _query: Record<string, unknown>,
  options: { filename?: string },
  tenant?: string,
): Promise<{ csv: string; filename: string; count: number }> {
  const subdomain = resolveTenant(tenant);
  const rows = await listFacultyDepartments(subdomain, { limit: null });
  const departments = rows as unknown as FacultyDepartmentEntity[];
  const csv = facultyDepartmentsToCsv(departments);
  const filename = buildTenantExportFilename(
    subdomain,
    options.filename?.trim() || "faculty-departments.csv",
  );
  return { csv, filename, count: departments.length };
}

/** Buffered CSV export of all active faculty designations. */
export async function buildFacultyDesignationsCsvExport(
  _query: Record<string, unknown>,
  options: { filename?: string },
  tenant?: string,
): Promise<{ csv: string; filename: string; count: number }> {
  const subdomain = resolveTenant(tenant);
  const designations = await listFacultyDesignations(subdomain, { limit: null });
  const csv = facultyDesignationsToCsv(designations);
  const filename = buildTenantExportFilename(
    subdomain,
    options.filename?.trim() || "faculty-designations.csv",
  );
  return { csv, filename, count: designations.length };
}
