import type { Faculty, FacultyQuickFilter } from "@mms/shared";
import { fetchAllFacultyForQuery } from "@/tenant/hooks/collections/faculty";
import { mapFacultyRow } from "@/components/ui/reports/facultyReportTypes";

/** Resolves full faculty roster rows for CSV/Excel/PDF export (server-side filters). */
export async function resolveFacultyReportExportRows(input: {
  search?: string;
  status?: string;
  quickFilter?: FacultyQuickFilter;
  gender?: string;
}): Promise<Record<string, unknown>[]> {
  const source = (await fetchAllFacultyForQuery(input)) as Faculty[];
  return source.map((facultyMember) => ({ ...mapFacultyRow(facultyMember) }));
}
