/**
 * @file transferFieldDef.ts
 * @description Single-source-of-truth (SSOT) field definition for module import/export.
 */

import type { ExportColumn } from "./exportTypes.js";
import type { CsvImportFieldMapping } from "../../csvImportMapper.js";
import type { CsvTemplateColumn } from "../../csvTemplateGenerator.js";

/**
 * Definition of a single data-transfer field.
 * Combines column labeling, export extraction, import parsing, and template metadata.
 *
 * @template TEntity The module domain or form entity type.
 */
export interface TransferFieldDefinition<TEntity = Record<string, unknown>> {
  /**
   * The property key on the entity or form model (e.g., 'firstName', 'gender', 'dob').
   * Must not be an internal system metadata key.
   */
  key: (keyof TEntity & string) | string;

  /**
   * The primary human-readable column header used in export and expected in import.
   * E.g., 'First Name', 'Gender', 'Date of Birth'.
   */
  label: string;

  /**
   * Alternative header strings accepted upon import (e.g. legacy headers, camelCase, snake_case).
   * Note: The entity `key` itself is automatically registered as a fallback alias.
   */
  aliases?: string[];

  /**
   * Whether this field is required when importing a row.
   */
  required?: boolean;

  /**
   * Sample value for template CSV generation.
   */
  sample?: string | number;

  /**
   * Custom cell extractor for export.
   * If omitted, defaults to accessing `entity[key]` with null/undefined formatted cleanly.
   */
  extract?: (entity: TEntity) => string | number | boolean | null | undefined;

  /**
   * Custom value parser / transformer for import.
   * If omitted, defaults to trimmed string value.
   */
  parse?: (rawValue: string) => unknown;
}

/**
 * Configuration options for creating a module data transfer schema.
 */
export interface ModuleTransferConfig<TEntity = Record<string, unknown>, TSettings = unknown> {
  /** Unique module identifier (e.g., 'contacts', 'students'). */
  moduleId: string;
  /** Human-readable entity noun in plural form (e.g., 'contacts', 'students'). */
  entityNounPlural: string;
  /**
   * Whitelist of form fields for import and export.
   * Any system metadata keys are automatically stripped.
   */
  fields: readonly TransferFieldDefinition<TEntity>[];
  /**
   * Optional default filename for CSV export (defaults to `${moduleId}.csv`).
   */
  defaultFilename?: string;
  /**
   * Optional custom column visibility filter based on user role or tenant settings.
   */
  filterColumns?: (
    columns: ExportColumn[],
    settings: TSettings | null | undefined,
    viewerRole: string,
  ) => ExportColumn[];
}

export type { ExportColumn, CsvImportFieldMapping, CsvTemplateColumn };
