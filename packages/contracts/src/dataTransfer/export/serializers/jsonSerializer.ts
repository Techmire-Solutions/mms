/**
 * @file jsonSerializer.ts
 * @description JSON export serialiser — converts a header+row grid to a
 * JSON array of objects (header keys → cell values).
 *
 * Output format:
 *   [{ "Name": "Ali Hassan", "Email": "ali@example.com" }, ...]
 *
 * Auto-registered on import.
 */
import { registerSerializer, type ExportSerializer } from "../exportSerializerRegistry.js";

export const jsonSerializer: ExportSerializer = {
  format: "json",
  contentType: "application/json; charset=utf-8",
  fileExtension: ".json",
  serialize(grid: unknown[][]): string {
    if (grid.length < 1) return "[]";

    const [headerRow, ...dataRows] = grid as unknown[][];

    if (!Array.isArray(headerRow) || headerRow.length === 0) return "[]";

    const headers = headerRow.map(String);

    const records = dataRows.map((row) => {
      const rowArr = Array.isArray(row) ? row : [];
      const obj: Record<string, unknown> = {};
      for (let i = 0; i < headers.length; i++) {
        const cell = rowArr[i];
        obj[headers[i]] = cell === "" || cell === undefined ? null : cell;
      }
      return obj;
    });

    return JSON.stringify(records, null, 0);
  },
};

registerSerializer(jsonSerializer);
