/**
 * @file xlsxExportSerializer.ts
 * @description XLSX export serializer using ExcelJS for the MMS backend.
 *
 * Placed in backend because ExcelJS and Buffer are server-only runtime dependencies.
 * Registers with the shared export serializer registry so format dispatch works seamlessly.
 */
import ExcelJS from "exceljs";
import type { ExportSerializer } from "@mms/shared";
import { registerSerializer } from "@mms/shared";

// ---------------------------------------------------------------------------
// XLSX buffer builder
// ---------------------------------------------------------------------------

/** Builds an XLSX Buffer from a header + row grid using ExcelJS. */
export async function buildXlsxBuffer(grid: unknown[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Export");

  if (grid.length === 0) {
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  const [headerRow, ...dataRows] = grid;
  const headers = Array.isArray(headerRow) ? headerRow.map(String) : [];

  // Header row — bold styling
  const header = sheet.addRow(headers);
  header.font = { bold: true };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  // Auto column widths based on header text
  sheet.columns = headers.map((h) => ({
    width: Math.min(Math.max(h.length + 4, 12), 50),
  }));

  // Data rows
  for (const row of dataRows) {
    const rowArr = Array.isArray(row) ? row : [];
    const cells = rowArr.map((cell) => (cell === null || cell === undefined ? "" : cell));
    sheet.addRow(cells);
  }

  // Freeze header row
  sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }];

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

// ---------------------------------------------------------------------------
// Serializer implementation
// ---------------------------------------------------------------------------

export const xlsxSerializer: ExportSerializer & {
  serializeBufferAsync(grid: unknown[][]): Promise<Buffer>;
} = {
  format: "xlsx",
  contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  fileExtension: ".xlsx",

  serialize(): string {
    throw new Error(
      "XLSX serialization is asynchronous. Use xlsxSerializer.serializeBufferAsync(grid) " +
        "or the background-job export route.",
    );
  },

  serializeBufferAsync(grid: unknown[][]): Promise<Buffer> {
    return buildXlsxBuffer(grid);
  },
};

registerSerializer(xlsxSerializer);
