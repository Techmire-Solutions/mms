import { describe, expect, it } from "vitest";
import {
  buildCustomReportPreviewRows,
  type PreviewCollections,
} from "./customReportBuilderPreview";
import { buildCustomReportExportColumns } from "./customReportBuilderExport";
import { extractExportTable } from "@mms/fe-core/reporting/reportExportCore";

const LABELS: Record<string, string> = {
  Name: "Student Name (translated)",
  Status: "Status",
  Class: "Class / Grade",
};
const resolveFieldLabel = (field: string): string => LABELS[field] ?? field;

const collections: PreviewCollections = {
  contacts: [],
  students: [
    { id: "1", name: "Ali Raza", status: "active", class: "Grade 1" },
    { id: "2", name: "Fatima Zahra", status: "active", class: "Grade 2" },
    { id: "3", name: "Zainab Noor", status: "inactive", class: "Grade 1" },
  ],
  sessions: [],
  financial: [],
  attendance: [],
  hasanat: [],
  academic: [],
};

function cellsFor(rows: Record<string, unknown>[], columns: { key: string }[]): unknown[][] {
  return rows.map((row) => columns.map((column) => row[column.key]));
}

describe("buildCustomReportExportColumns", () => {
  it("given translated field labels, should read every preview cell when exporting", () => {
    const selectedFields = ["Name", "Status", "Class"];
    const rows = buildCustomReportPreviewRows({
      source: "students",
      selectedFields,
      aggregate: "None",
      groupBy: "",
      collections,
      currencyCode: "USD",
      translate: (key) => key,
      resolveFieldLabel,
    });
    const columns = buildCustomReportExportColumns(selectedFields, resolveFieldLabel);

    expect(columns.map((column) => column.header)).toEqual([
      "Student Name (translated)",
      "Status",
      "Class / Grade",
    ]);
    expect(cellsFor(rows, columns)).toEqual(rows.map((row) => Object.values(row)));
    expect(cellsFor(rows, columns).flat()).not.toContain(undefined);
  });

  it("given a grouped Count aggregate, should export the group and aggregate cells", () => {
    const selectedFields = ["Class", "Name"];
    const rows = buildCustomReportPreviewRows({
      source: "students",
      selectedFields,
      aggregate: "Count",
      groupBy: "Class",
      collections,
      currencyCode: "USD",
      translate: (key) => key,
      resolveFieldLabel,
    });
    const columns = buildCustomReportExportColumns(selectedFields, resolveFieldLabel);

    expect(cellsFor(rows, columns)).toEqual([
      ["Grade 1", 2],
      ["Grade 2", 1],
    ]);
  });

  it("given two fields with the same label, should export the column once", () => {
    const columns = buildCustomReportExportColumns(["Name", "Name", "Status"], resolveFieldLabel);
    expect(columns.map((column) => column.header)).toEqual(["Student Name (translated)", "Status"]);
  });

  it("given the same preview rows, should give Document (PDF) and Excel the same table", () => {
    // Arrange
    const selectedFields = ["Name", "Status", "Class"];
    const rows = buildCustomReportPreviewRows({
      source: "students",
      selectedFields,
      aggregate: "None",
      groupBy: "",
      collections,
      currencyCode: "USD",
      translate: (key) => key,
      resolveFieldLabel,
    });
    const columns = buildCustomReportExportColumns(selectedFields, resolveFieldLabel);

    // Act
    const excelKeysTable = extractExportTable(undefined, rows);
    const fixedTable = extractExportTable(columns, rows);

    // Assert
    expect(fixedTable.headers).toEqual(excelKeysTable.headers);
    expect(fixedTable.data).toEqual(excelKeysTable.data);
    expect(fixedTable.data).toHaveLength(3);
  });
});
