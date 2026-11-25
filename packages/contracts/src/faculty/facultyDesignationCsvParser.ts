import { parseCsvRows } from "../core/csvParserCore.js";
import { parseFacultyCatalogStatus } from "./facultyDepartmentCsvParser.js";
import type { FacultyCatalogStatus } from "./facultyTypes.js";

export interface FacultyDesignationCsvRow {
  /** Department name (matched case-insensitively against the department catalog). */
  department: string;
  name: string;
  /** Parent designation name inside the same import/catalog (optional). */
  parentDesignation?: string;
  status: FacultyCatalogStatus;
}

const ALIASES: Record<string, keyof FacultyDesignationCsvRow | "skip"> = {
  department: "department",
  departmentname: "department",
  department_name: "department",
  name: "name",
  designation: "name",
  designationname: "name",
  parentdesignation: "parentDesignation",
  parent_designation: "parentDesignation",
  parent: "parentDesignation",
  status: "status",
  isactive: "status",
  is_active: "status",
  active: "status",
};

function normHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, "");
}

/** Parse designations CSV into write-ready rows (match/upsert by department + name). */
export function parseFacultyDesignationsCsv(csvText: string): FacultyDesignationCsvRow[] {
  const grid = parseCsvRows(csvText);
  if (grid.length < 2) return [];
  const headers = grid[0].map(normHeader);
  const indexes = headers.map((header) => ALIASES[header] ?? "skip");
  const out: FacultyDesignationCsvRow[] = [];

  for (let rowIndex = 1; rowIndex < grid.length; rowIndex += 1) {
    const cells = grid[rowIndex];
    if (!cells.some((cell) => cell.trim())) continue;
    let department = "";
    let name = "";
    let parentDesignation: string | undefined;
    let status: FacultyCatalogStatus = "active";
    for (let column = 0; column < indexes.length; column += 1) {
      const key = indexes[column];
      const value = (cells[column] ?? "").trim();
      if (key === "department") department = value;
      else if (key === "name") name = value;
      else if (key === "parentDesignation") parentDesignation = value || undefined;
      else if (key === "status") status = parseFacultyCatalogStatus(value);
    }
    if (!department || !name) continue;
    out.push({ department, name, parentDesignation, status });
  }
  return out;
}
