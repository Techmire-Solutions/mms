import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildXlsxBuffer } from "../lib/xlsxExportSerializer.js";

describe("XLSX export formula safety", () => {
  it("writes formula-looking cells as literal strings, never formulas", async () => {
    const buffer = await buildXlsxBuffer([
      ["Name", "Note"],
      ["=2+2", "plain"],
      ["+SUM(A1)", "@cmd"],
      ["@DDE", "-1"],
      ["|calc.exe", "%COMSPEC%"],
      ["\t=tab", "\r=cr"],
    ]);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);
    const sheet = workbook.getWorksheet("Export")!;
    const values: Array<[number, number, unknown]> = [
      [2, 1, "=2+2"],
      [3, 1, "+SUM(A1)"],
      [4, 1, "@DDE"],
      [2, 2, "plain"],
      [3, 2, "@cmd"],
      [4, 2, "-1"],
      [5, 1, "|calc.exe"],
      [5, 2, "%COMSPEC%"],
      [6, 1, "\t=tab"],
      [6, 2, "\n=cr"],
    ];
    for (const [row, col, expected] of values) {
      const cell = sheet.getCell(row, col);
      expect(cell.value).toBe(expected);
      expect(cell.formula).toBeUndefined();
      expect(cell.type).toBe(ExcelJS.ValueType.String);
    }
  });
});
