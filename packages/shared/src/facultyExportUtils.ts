/**
 * @file facultyExportUtils.ts
 * @description Faculty module export utilities.
 */
import type { FieldDefinition } from "./contactTypes.js";
import type { FacultyMember } from "./facultyTypes.js";
import type { FacultySettings } from "./facultyModuleSettings.js";
import { isFacultyLockedEnabledTab } from "./moduleFieldSetupPersons.js";
import {
  DEFAULT_FACULTY_EXPORT_COLUMNS,
  FACULTY_COLUMN_FIELD_MAPPING,
  type FacultyWorkColumnKey,
} from "./facultyDirectoryColumns.js";
import { resolveFacultyEnabledTabIds } from "./facultyEnabledTabs.js";
import { customFieldKeyFromColumnKey } from "./moduleColumnCore.js";
import { resolveFacultyFieldsMapForColumnSync } from "./facultyFormCustomFields.js";
import { formatFacultyFieldCellValue } from "./facultyFieldCellFormat.js";
import { filterExportColumnsByVisibility } from "./dataTransfer/export/filterExportColumns.js";
import { buildExportGrid } from "./dataTransfer/export/buildExportGrid.js";
import type { ExportColumn, ExportCellExtractor } from "./dataTransfer/core/exportTypes.js";
import {
  type FacultyExportColumn,
  ALL_FACULTY_EXPORT_COLUMNS,
  resolveAllFacultyExportColumns,
  mergeCustomFacultyExportColumns,
} from "./facultyExportColumns.js";

export type { FacultyExportColumn };
export {
  ALL_FACULTY_EXPORT_COLUMNS,
  resolveAllFacultyExportColumns,
  mergeCustomFacultyExportColumns,
  DEFAULT_FACULTY_EXPORT_COLUMNS,
};

/** CSV identity columns always exported regardless of Setup field registry. */
const FACULTY_EXPORT_ALWAYS_VISIBLE = new Set(["name", "employeeId"]);

function resolveExportFieldKey(columnId: string): string {
  const customFieldId = customFieldKeyFromColumnKey(columnId);
  if (customFieldId !== null) return customFieldId;
  const mapping = FACULTY_COLUMN_FIELD_MAPPING[columnId as FacultyWorkColumnKey];
  return mapping?.fieldId ?? columnId;
}

/**
 * Filters export columns by Setup field/tab enablement + viewer role.
 * Uses `filterExportColumnsByVisibility` from the shared data-transfer pipeline.
 */
export function filterFacultyExportColumnsForViewer(
  columns: FacultyExportColumn[],
  settings?: FacultySettings | null,
  viewerRole?: string,
): FacultyExportColumn[] {
  const source =
    columns.length > 0
      ? columns.length >= DEFAULT_FACULTY_EXPORT_COLUMNS.length
        ? mergeCustomFacultyExportColumns(columns, settings)
        : columns
      : resolveAllFacultyExportColumns(settings);
  if (!settings) return source;

  const fields = resolveFacultyFieldsMapForColumnSync(settings.fields);
  const enabledTabs = new Set(resolveFacultyEnabledTabIds(settings));
  const formTabs = settings.formTabs ?? [];

  const columnAliases: Record<string, string> = {};
  for (const col of source) {
    const fieldKey = resolveExportFieldKey(col.id);
    if (fieldKey !== col.id) columnAliases[col.id] = fieldKey;
  }

  const allTabIds = new Set([
    ...enabledTabs,
    ...formTabs.map((t) => t.key),
    ...Object.keys(fields),
  ]);
  const lockedTabIds = new Set<string>();
  for (const tabId of allTabIds) {
    if (isFacultyLockedEnabledTab(tabId)) lockedTabIds.add(tabId);
  }

  return filterExportColumnsByVisibility(source as ExportColumn[], {
    fieldsByTab: fields,
    formTabs,
    viewerRole: viewerRole ?? "",
    alwaysVisible: FACULTY_EXPORT_ALWAYS_VISIBLE,
    columnAliases,
    lockedTabIds,
  }) as FacultyExportColumn[];
}

function buildFieldTypeMap(
  fields: Record<string, FieldDefinition[]> | undefined,
): Map<string, FieldDefinition["type"]> {
  const map = new Map<string, FieldDefinition["type"]>();
  if (!fields) return map;
  for (const tabFields of Object.values(fields)) {
    for (const field of tabFields) {
      if (field.key && !map.has(field.key)) {
        map.set(field.key, field.type);
      }
    }
  }
  return map;
}

/** Creates a pure cell extractor for FacultyMember entities. */
export function createFacultyCellExtractor(
  settings?: FacultySettings | null,
): ExportCellExtractor<FacultyMember> {
  const fields = settings ? resolveFacultyFieldsMapForColumnSync(settings.fields) : undefined;
  const fieldTypeMap = buildFieldTypeMap(fields);

  return (faculty: FacultyMember, columnId: string): string | number | null => {
    const propKey = resolveExportFieldKey(columnId) as keyof FacultyMember;
    const fieldType = fieldTypeMap.get(propKey as string);
    const customObj = faculty.customFields as Record<string, unknown> | undefined;
    const cellVal = faculty[propKey] ?? customObj?.[propKey as string] ?? customObj?.[columnId];
    if (cellVal === undefined || cellVal === null) return "";

    const formatted = formatFacultyFieldCellValue(cellVal, {
      fieldType,
      propKey: propKey as string,
      arraySeparator: "; ",
    });
    if (formatted !== null && formatted !== undefined) return formatted;
    if (typeof cellVal === "boolean") return cellVal ? "true" : "false";
    if (typeof cellVal === "number") return cellVal;
    if (typeof cellVal === "string") return cellVal;
    if (Array.isArray(cellVal)) return cellVal.map(String).filter(Boolean).join("; ");
    if (typeof cellVal === "object") return JSON.stringify(cellVal);
    return String(cellVal);
  };
}

/** Builds a 2D grid [header, ...rows] for the given faculty and columns. */
export function buildFacultyExportRows(
  faculty: FacultyMember[],
  columns: FacultyExportColumn[],
  settings?: FacultySettings | null,
): unknown[][] {
  const extractCell = createFacultyCellExtractor(settings);
  return buildExportGrid(faculty, columns as ExportColumn[], extractCell);
}
