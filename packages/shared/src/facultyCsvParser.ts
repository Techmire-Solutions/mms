import { parseCsvRows } from "./csvParserCore.js";
import { facultyTransferSchema } from "./dataTransfer/schemas/facultyTransferSchema.js";

export interface FacultyCsvImportRow {
  name?: string;
  employeeId?: string;
  contactId?: string;
  specialization?: string;
  department?: string;
  designation?: string;
  status?: string;
  qualification?: string;
  employmentStartDate?: string;
  employmentEndDate?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

const ALIASES: Record<string, keyof FacultyCsvImportRow | "skip"> = {
  employeeid: "employeeId",
  employee_id: "employeeId",
  contactid: "contactId",
  contact_id: "contactId",
  specialization: "specialization",
  department: "department",
  designation: "designation",
  status: "status",
  qualification: "qualification",
  employmentstartdate: "employmentStartDate",
  employment_start_date: "employmentStartDate",
  startdate: "employmentStartDate",
  joindate: "employmentStartDate",
  join_date: "employmentStartDate",
  employmentenddate: "employmentEndDate",
  employment_end_date: "employmentEndDate",
  enddate: "employmentEndDate",
  name: "name",
  phone: "phone",
  email: "email",
};

function normHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "");
}

/** Parse faculty member CSV using SSOT facultyTransferSchema with legacy fallback. */
export function parseFacultyMembersCsv(csvText: string): FacultyCsvImportRow[] {
  const schemaResult = facultyTransferSchema.fromImportCsv(csvText);
  if (schemaResult.rows.length > 0 && schemaResult.missingHeaders.length === 0) {
    return schemaResult.rows as FacultyCsvImportRow[];
  }

  const grid = parseCsvRows(csvText);
  if (grid.length < 2) return [];
  const headers = grid[0].map(normHeader);
  const indexes = headers.map((h) => ALIASES[h] ?? "skip");
  const out: FacultyCsvImportRow[] = [];

  for (let r = 1; r < grid.length; r += 1) {
    const cells = grid[r];
    if (!cells.some((c) => c.trim())) continue;
    const row: FacultyCsvImportRow = {};
    for (let c = 0; c < indexes.length; c += 1) {
      const key = indexes[c];
      if (key === "skip") continue;
      const val = (cells[c] ?? "").trim();
      if (val) row[key] = val;
    }
    if (!row.employeeId && !row.contactId) continue;
    out.push(row);
  }
  return out;
}
