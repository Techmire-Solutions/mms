import type { Faculty, FacultyQuickFilter } from "@mms/contracts";
import { fetchAllFacultyForQuery } from "../../host/collections";
import { mapFacultyRow } from "../../components/facultyReportTypes";

/** Resolves full faculty roster rows for CSV/Excel/PDF export (server-side filters). */
export async function resolveFacultyReportExportRows(input: {
  search?: string;
  status?: string;
  quickFilter?: FacultyQuickFilter;
  gender?: string;
}): Promise<Record<string, unknown>[]> {
  const source = (await fetchAllFacultyForQuery(input)) as Faculty[];
  return source.map((facultyMember: any) => ({ ...mapFacultyRow(facultyMember) }));
}
