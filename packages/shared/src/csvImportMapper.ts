/**
 * @file csvImportMapper.ts
 * @description Pure CSV grid to typed entity mapping utility.
 */

export interface CsvImportFieldMapping<T = Record<string, unknown>> {
  key: (keyof T & string) | string;
  header: string;
  aliases?: string[];
  required?: boolean;
  transform?: (raw: string) => unknown;
}

export interface CsvImportMapResult<T> {
  rows: T[];
  missingHeaders: string[];
  rowErrors: Array<{ row: number; error: string }>;
}

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

/**
 * Maps a 2D string grid (from parseCsvRows) into typed objects based on field descriptors.
 */
export function mapCsvGridToObjects<T = Record<string, unknown>>(
  grid: string[][],
  mappings: CsvImportFieldMapping<T>[],
): CsvImportMapResult<T> {
  if (!grid || grid.length < 2) {
    return { rows: [], missingHeaders: [], rowErrors: [] };
  }

  const headerRow = grid[0];
  const headerColIndex = new Map<string, number>();

  for (let c = 0; c < headerRow.length; c++) {
    const rawHeader = headerRow[c];
    if (rawHeader) {
      headerColIndex.set(normalizeHeader(rawHeader), c);
    }
  }

  const missingHeaders: string[] = [];
  const fieldToCol = new Map<CsvImportFieldMapping<T>, number>();

  for (const mapping of mappings) {
    let colIdx: number | undefined = headerColIndex.get(normalizeHeader(mapping.header));

    if (colIdx === undefined && mapping.aliases) {
      for (const alias of mapping.aliases) {
        colIdx = headerColIndex.get(normalizeHeader(alias));
        if (colIdx !== undefined) break;
      }
    }

    if (colIdx !== undefined) {
      fieldToCol.set(mapping, colIdx);
    } else if (mapping.required) {
      missingHeaders.push(mapping.header);
    }
  }

  if (missingHeaders.length > 0) {
    return { rows: [], missingHeaders, rowErrors: [] };
  }

  const rows: T[] = [];
  const rowErrors: Array<{ row: number; error: string }> = [];

  for (let r = 1; r < grid.length; r++) {
    const line = grid[r];
    // Skip entirely empty row
    if (line.every((cell) => cell.trim().length === 0)) {
      continue;
    }

    const rowObj: Record<string, unknown> = {};
    let hasError = false;

    for (const [mapping, colIdx] of fieldToCol.entries()) {
      const rawVal = line[colIdx]?.trim() ?? "";

      if (mapping.required && rawVal.length === 0) {
        rowErrors.push({ row: r + 1, error: `Missing required field: ${mapping.header}` });
        hasError = true;
        break;
      }

      if (rawVal.length > 0) {
        if (mapping.transform) {
          try {
            rowObj[mapping.key] = mapping.transform(rawVal);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            rowErrors.push({ row: r + 1, error: `Invalid ${mapping.header}: ${msg}` });
            hasError = true;
            break;
          }
        } else {
          rowObj[mapping.key] = rawVal;
        }
      }
    }

    if (!hasError) {
      rows.push(rowObj as T);
    }
  }

  return { rows, missingHeaders: [], rowErrors };
}
