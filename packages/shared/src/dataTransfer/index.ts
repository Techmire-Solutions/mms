/**
 * @file index.ts
 * @description Barrel for the `@mms/shared` data-transfer sub-namespace.
 *
 * Pure exports only — no I/O, no Node.js built-ins.
 * Safe to import from frontend and backend.
 *
 * NOTE: `xlsxSerializer` is intentionally NOT re-exported here because it
 * uses a dynamic `import('exceljs')` that must remain server-side only.
 * Import it directly in backend code:
 *   import '@mms/shared/src/dataTransfer/export/serializers/xlsxSerializer';
 */

// Core types
export type {
  ExportColumn,
  ExportFormat,
  ExportCellExtractor,
  ExportSpec,
} from "./core/exportTypes.js";
export type { ImportRowError, ImportResult, ImportSpec } from "./core/importTypes.js";
export { CSV_IMPORT_MAX_BATCH_DEFAULT } from "./core/importTypes.js";
export {
  DataTransferError,
  ExportLimitError,
  ImportValidationError,
  UnknownFormatError,
} from "./core/transferErrors.js";
export {
  SYSTEM_METADATA_KEYS,
  isSystemMetadataKey,
  filterNonMetadataKeys,
  filterNonMetadataColumns,
} from "./core/systemMetadata.js";
export type { TransferFieldDefinition, ModuleTransferConfig } from "./core/transferFieldDef.js";
export {
  createModuleTransferSchema,
  type ModuleTransferSchema,
} from "./core/moduleTransferSchema.js";
export {
  registerModuleTransferSchema,
  getAllModuleTransferCoverage,
  getModuleTransferCoverage,
  getModuleTransferSchema,
  isModuleTransferImplemented,
  type ModuleTransferCoverageRecord,
  type ModuleTransferStatus,
  type MigrationPriority,
} from "./registry/moduleTransferRegistry.js";

// Export pipeline
export {
  filterExportColumnsByVisibility,
  buildSimpleVisibilityContext,
  type FieldVisibilityContext,
} from "./export/filterExportColumns.js";
export { buildExportGrid, yieldExportGridChunks } from "./export/buildExportGrid.js";
export {
  registerSerializer,
  getSerializer,
  hasSerializer,
  registeredFormats,
  type ExportSerializer,
} from "./export/exportSerializerRegistry.js";

// Serialisers (CSV + JSON are safe for shared — no server-only deps)
export { csvSerializer } from "./export/serializers/csvSerializer.js";
export { jsonSerializer } from "./export/serializers/jsonSerializer.js";

// Import pipeline
export { validateImportRows, type RowValidationResult } from "./import/validateImportRows.js";
export {
  runImportPipeline,
  type ImportPipelineContext,
  type ImportBatchFn,
} from "./import/importPipelineRunner.js";
export {
  mapCsvGridToObjects,
  type CsvImportFieldMapping,
  type CsvImportMapResult,
} from "../csvImportMapper.js";
export { generateCsvTemplate, type CsvTemplateColumn } from "../csvTemplateGenerator.js";

// Schemas
export * from "./schemas/index.js";
