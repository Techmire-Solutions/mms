/**
 * @file filterExportColumns.ts
 * @description Universal tab/field visibility filter for module exports.
 *
 * Replaces the six near-identical per-module functions:
 *   - filterContactExportColumnsForViewer
 *   - filterStudentExportColumnsForViewer
 *   - filterFacultyExportColumnsForViewer
 *   - filterEnrollmentsExportColumnsForViewer
 *   - filterSessionsExportColumnsForViewer
 *   - filterUsersExportColumnsForViewer
 *
 * Each module builds a `FieldVisibilityContext` from its settings and
 * passes it to this function together with the requested column list.
 */
import type { FieldDefinition, TabDefinition } from "../../contactFieldSchemaTypes.js";
import { canViewContactField, canViewContactTab } from "../../contactFieldAccess.js";
import type { ExportColumn } from "../core/exportTypes.js";

// ---------------------------------------------------------------------------
// Context type
// ---------------------------------------------------------------------------

export interface FieldVisibilityContext {
  /**
   * Field registry keyed by tab id, from module settings.
   * Example: `{ personal: [...], work: [...] }`.
   */
  fieldsByTab: Record<string, FieldDefinition[]>;

  /** All tab definitions from module settings (`formTabs` / equivalent). */
  formTabs: TabDefinition[];

  /** RBAC role of the requesting user (compared against `permissions[]`). */
  viewerRole: string;

  /**
   * Column ids that are always exported regardless of field registry state.
   * Typical identity columns: `'name'`, `'grNumber'`, `'employeeId'`.
   */
  alwaysVisible?: ReadonlySet<string>;

  /**
   * Maps a column id to the field key in the registry when they differ.
   * Example: `{ parents: 'contactRelationships', sessions: 'enrolledSessions' }`.
   */
  columnAliases?: Readonly<Record<string, string>>;

  /**
   * Tab ids that are locked — always enabled regardless of `.enabled` flag.
   * Example: `{ personal, identity }` for person modules.
   */
  lockedTabIds?: ReadonlySet<string>;
}

// ---------------------------------------------------------------------------
// Helpers (module-private)
// ---------------------------------------------------------------------------

function buildTabMap(formTabs: TabDefinition[]): Map<string, TabDefinition> {
  const map = new Map<string, TabDefinition>();
  for (const tab of formTabs) {
    if (tab.key) map.set(tab.key.toLowerCase(), tab);
  }
  return map;
}

function buildFieldLocationMap(
  fieldsByTab: Record<string, FieldDefinition[]>,
): Map<string, { tabId: string; field: FieldDefinition }> {
  const map = new Map<string, { tabId: string; field: FieldDefinition }>();
  for (const [tabId, tabFields] of Object.entries(fieldsByTab)) {
    for (const field of tabFields) {
      // First registration wins (prevents aliased keys from overwriting primary).
      if (field.key && !map.has(field.key)) {
        map.set(field.key, { tabId, field });
      }
    }
  }
  return map;
}

function isTabAllowed(
  tabId: string,
  lockedTabIds: ReadonlySet<string> | undefined,
  tabMap: Map<string, TabDefinition>,
  viewerRole: string,
  hasFormTabs: boolean,
): boolean {
  if (lockedTabIds?.has(tabId)) return true;
  if (!hasFormTabs) return true;
  const tab = tabMap.get(tabId.toLowerCase());
  if (!tab) return true; // unmapped tabs are permitted (compat)
  return canViewContactTab(viewerRole, tab);
}

// ---------------------------------------------------------------------------
// Primary export
// ---------------------------------------------------------------------------

/**
 * Filters an export column list by tab enablement and field-level role
 * permissions stored in module settings.
 *
 * **Rules (applied in order):**
 * 1. Always-visible columns pass unconditionally.
 * 2. Columns with no matching registry entry pass (unknown = allow, compat).
 * 3. Columns whose governing field is disabled in Setup are removed.
 * 4. Columns whose governing tab is disabled or invisible to `viewerRole` are removed.
 * 5. Columns whose field has a `permissions[]` that excludes `viewerRole` are removed.
 *
 * @param columns - Requested export columns (already defaulted by caller).
 * @param ctx     - Visibility context built from module settings + viewer role.
 */
export function filterExportColumnsByVisibility(
  columns: ExportColumn[],
  ctx: FieldVisibilityContext,
): ExportColumn[] {
  const { fieldsByTab, formTabs, viewerRole, alwaysVisible, columnAliases, lockedTabIds } = ctx;

  // Short-circuit: no field registry configured → all columns visible.
  if (!fieldsByTab || Object.keys(fieldsByTab).length === 0) return columns;

  const tabMap = buildTabMap(formTabs);
  const fieldLocationMap = buildFieldLocationMap(fieldsByTab);
  const hasFormTabs = formTabs.length > 0;

  return columns.filter((col) => {
    if (alwaysVisible?.has(col.id)) return true;

    const fieldKey = columnAliases?.[col.id] ?? col.id;
    const located = fieldLocationMap.get(fieldKey);

    if (!located) return true; // no Setup row → keep (compat)

    const { tabId, field } = located;

    if (field.enabled === false) return false;

    if (!isTabAllowed(tabId, lockedTabIds, tabMap, viewerRole, hasFormTabs)) return false;

    return canViewContactField(viewerRole, field);
  });
}

// ---------------------------------------------------------------------------
// Context builder helpers (used by module specs)
// ---------------------------------------------------------------------------

/**
 * Convenience builder for modules where all fields live in a flat
 * tab-keyed record with no column aliases.
 */
export function buildSimpleVisibilityContext(
  fieldsByTab: Record<string, FieldDefinition[]>,
  formTabs: TabDefinition[],
  viewerRole: string,
  alwaysVisible?: ReadonlySet<string>,
  columnAliases?: Record<string, string>,
  lockedTabIds?: ReadonlySet<string>,
): FieldVisibilityContext {
  return { fieldsByTab, formTabs, viewerRole, alwaysVisible, columnAliases, lockedTabIds };
}
