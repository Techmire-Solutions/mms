import { parseCsvRows } from "../core/csvParserCore.js";
import type { FacultyCatalogStatus } from "./facultyTypes.js";

export interface FacultyDepartmentCsvRow {
  name: string;
  description?: string;
  status: FacultyCatalogStatus;
}

const ALIASES: Record<string, keyof FacultyDepartmentCsvRow | "skip"> = {
  name: "name",
  department: "name",
  departmentname: "name",
  description: "description",
  status: "status",
  isactive: "status",
  is_active: "status",
  active: "status",
};

function normHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, "");
}

/** Accepts `active|inactive` plus legacy boolean spellings (`true|false|1|0|yes|no`). */
export function parseFacultyCatalogStatus(raw: string): FacultyCatalogStatus {
  const value = raw.trim().toLowerCase();
  if (
    value === "inactive" ||
    value === "0" ||
    value === "false" ||
    value === "no" ||
    value === "n"
  ) {
    return "inactive";
  }
  return "active";
}

/** Parse departments CSV into write-ready rows (match/upsert by case-insensitive name). */
export function parseFacultyDepartmentsCsv(csvText: string): FacultyDepartmentCsvRow[] {
  const grid = parseCsvRows(csvText);
  if (grid.length < 2) return [];
  const headers = grid[0].map(normHeader);
  const indexes = headers.map((header) => ALIASES[header] ?? "skip");
  const out: FacultyDepartmentCsvRow[] = [];

  for (let rowIndex = 1; rowIndex < grid.length; rowIndex += 1) {
    const cells = grid[rowIndex];
    if (!cells.some((cell) => cell.trim())) continue;
    let name = "";
    let description: string | undefined;
    let status: FacultyCatalogStatus = "active";
    for (let column = 0; column < indexes.length; column += 1) {
      const key = indexes[column];
      const value = (cells[column] ?? "").trim();
      if (key === "name") name = value;
      else if (key === "description") description = value || undefined;
      else if (key === "status") status = parseFacultyCatalogStatus(value);
    }
    if (!name) continue;
    out.push({ name, description, status });
  }
  return out;
}
