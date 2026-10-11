/**
 * @file moduleTransferSchema.ts
 * @description Standardized, DRY and symmetric import/export schema factory.
 */

import type { ExportColumn, ExportSpec, ExportCellExtractor } from "./exportTypes.js";
import type { CsvImportFieldMapping, CsvImportMapResult } from "../../csvImportMapper.js";
import type { CsvTemplateColumn } from "../../csvTemplateGenerator.js";
import type { TransferFieldDefinition, ModuleTransferConfig } from "./transferFieldDef.js";
import { isSystemMetadataKey } from "./systemMetadata.js";
import { generateCsvTemplate } from "../../csvTemplateGenerator.js";
import { buildExportGrid } from "../export/buildExportGrid.js";
import { csvSerializer } from "../export/serializers/csvSerializer.js";
import { parseCsvRows } from "../../csvParserCore.js";
import { mapCsvGridToObjects } from "../../csvImportMapper.js";

export interface ModuleTransferSchema<TEntity = Record<string, unknown>, TSettings = unknown> {
  readonly moduleId: string;
  readonly entityNounPlural: string;
  readonly defaultFilename: string;
  readonly fields: readonly TransferFieldDefinition<TEntity>[];
  readonly exportColumns: ExportColumn[];
  readonly extractCell: ExportCellExtractor<TEntity>;
  readonly importMappings: CsvImportFieldMapping<TEntity>[];
  readonly templateColumns: CsvTemplateColumn[];
  readonly exportSpec: ExportSpec<TEntity, TSettings>;
  generateTemplate(): string;
  buildGrid(entities: TEntity[], columns?: ExportColumn[]): unknown[][];
  toExportCsv(entities: TEntity[], columns?: ExportColumn[]): string;
  fromImportCsv(csvText: string): CsvImportMapResult<TEntity>;
  mapGrid(grid: string[][]): CsvImportMapResult<TEntity>;
}

function defaultExtract<TEntity>(entity: TEntity, key: string): unknown {
  const record = entity as Record<string, unknown>;
  const val = record[key];
  if (val === undefined || val === null) return "";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  return val;
}

/**
 * Creates a standardized, DRY, and symmetric data transfer schema for a module.
 * Guaranteed to:
 * 1. Strip internal system metadata (id, created_at, tenant_id, etc.).
 * 2. Ensure exported headers exactly match accepted import column headers.
 * 3. Consolidate column definitions, labels, and parsing rules into a single SSOT.
 */
export function createModuleTransferSchema<TEntity = Record<string, unknown>, TSettings = unknown>(
  config: ModuleTransferConfig<TEntity, TSettings>,
): ModuleTransferSchema<TEntity, TSettings> {
  const { moduleId, entityNounPlural, defaultFilename, filterColumns } = config;
  // Enforce Field Whitelist: strip any internal system metadata keys from keys & labels.
  const fields = config.fields.filter(
    (f) => !isSystemMetadataKey(f.key) && (!f.label || !isSystemMetadataKey(f.label)),
  );

  // Derived Export Columns (Human-readable headers)
  const exportColumns: ExportColumn[] = fields.map((f) => ({
    id: f.key,
    label: f.label,
  }));

  // Cell Extractor using field-level extract or clean default
  const extractCell: ExportCellExtractor<TEntity> = (entity, columnId) => {
    const field = fields.find((f) => f.key === columnId);
    if (field?.extract) {
      return field.extract(entity);
    }
    return defaultExtract(entity, columnId) as string | number | boolean | null | undefined;
  };

  // Symmetrical Import Mappings: primary header matches export label exactly!
  const importMappings: CsvImportFieldMapping<TEntity>[] = fields.map((f) => {
    const aliases = new Set<string>();
    // Register the property key and any defined non-metadata aliases
    if (!isSystemMetadataKey(f.key)) aliases.add(f.key);
    if (f.aliases) {
      for (const a of f.aliases) {
        if (!isSystemMetadataKey(a)) aliases.add(a);
      }
    }
    return {
      key: f.key,
      header: f.label,
      aliases: Array.from(aliases),
      required: f.required,
      transform: f.parse,
    };
  });

  // Template Columns
  const templateColumns: CsvTemplateColumn[] = fields.map((f) => ({
    header: f.label,
    sample: f.sample,
    required: f.required,
  }));

  const exportSpec: ExportSpec<TEntity, TSettings> = {
    defaultColumns: exportColumns,
    filterColumns: (cols, settings, viewerRole) =>
      filterColumns ? filterColumns(cols, settings, viewerRole) : cols,
    extractCell,
  };

  const filename = defaultFilename ?? `${moduleId}.csv`;

  return {
    moduleId,
    entityNounPlural,
    defaultFilename: filename,
    fields,
    exportColumns,
    extractCell,
    importMappings,
    templateColumns,
    exportSpec,
    generateTemplate: () => generateCsvTemplate(templateColumns),
    buildGrid: (entities, cols) => buildExportGrid(entities, cols ?? exportColumns, extractCell),
    toExportCsv: (entities, cols) => {
      const grid = buildExportGrid(entities, cols ?? exportColumns, extractCell);
      return csvSerializer.serialize(grid);
    },
    fromImportCsv: (csvText) => {
      const grid = parseCsvRows(csvText);
      return mapCsvGridToObjects<TEntity>(grid, importMappings);
    },
    mapGrid: (grid) => mapCsvGridToObjects<TEntity>(grid, importMappings),
  };
}
