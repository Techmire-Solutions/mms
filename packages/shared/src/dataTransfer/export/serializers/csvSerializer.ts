/**
 * @file csvSerializer.ts
 * @description CSV export serialiser — wraps the existing `buildCsvContent`
 * utility and registers with the format registry.
 *
 * Auto-registered on import so callers only need:
 *   import '@mms/shared/dataTransfer/export/serializers/csvSerializer';
 * or import the barrel `@mms/shared/dataTransfer`.
 */
import { buildCsvContent } from "../../../core/csvUtils.js";
import { registerSerializer, type ExportSerializer } from "../exportSerializerRegistry.js";

export const csvSerializer: ExportSerializer = {
  format: "csv",
  contentType: "text/csv; charset=utf-8",
  fileExtension: ".csv",
  serialize(grid: unknown[][]): string {
    return buildCsvContent(grid);
  },
};

// Auto-register so the registry is populated on first import.
registerSerializer(csvSerializer);
