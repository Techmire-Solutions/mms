/**
 * @file csvTemplateGenerator.ts
 * @description Generates RFC 4180 CSV template strings for module data imports.
 */

import { buildCsvContent } from "./csvUtils.js";

export interface CsvTemplateColumn {
  header: string;
  sample?: string | number;
  required?: boolean;
}

/**
 * Generates downloadable CSV template content with header and sample rows.
 */
export function generateCsvTemplate(columns: CsvTemplateColumn[]): string {
  if (!columns || columns.length === 0) return "";

  const headers = columns.map((col) => col.header);
  const sampleRow = columns.map((col) => col.sample ?? "");

  const rows: unknown[][] = [headers];
  if (sampleRow.some((val) => val !== "")) {
    rows.push(sampleRow);
  }

  return buildCsvContent(rows);
}
