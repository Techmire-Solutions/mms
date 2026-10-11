import type { ColumnRegistryEntry } from "./contactTypes.js";

export interface ModuleFieldRemovalIssuesOptions {
  systemFieldKeys: ReadonlySet<string>;
  columnFieldMapping: Record<string, { tabId: string; fieldId: string }>;
  messageKeys: {
    systemField: string;
    fieldUsedInColumn: string;
  };
}

export interface ModuleFieldDependencyInput {
  fieldKey: string;
  columnRegistry: ColumnRegistryEntry[];
}

export interface ModuleFieldDependencyIssue {
  area: "systemField" | "column";
  /** i18n key — FE passes to t() with optional { count }. */
  messageKey: string;
  count?: number;
}

/**
 * Shared Setup field-removal dependency check (seed system keys + Work column usage).
 * Teachers/Students adapters pass their seed keys, column↔field mapping, and message keys.
 */
export function createFieldRemovalIssuesChecker(options: ModuleFieldRemovalIssuesOptions) {
  const columnKeysByField = new Map<string, string[]>();
  for (const [columnKey, mapping] of Object.entries(options.columnFieldMapping)) {
    const list = columnKeysByField.get(mapping.fieldId) ?? [];
    list.push(columnKey);
    columnKeysByField.set(mapping.fieldId, list);
  }

  /** Work column keys that mirror a Setup field id (including mapped columns). */
  function columnKeysForField(fieldKey: string): string[] {
    const mapped = columnKeysByField.get(fieldKey) ?? [];
    return [fieldKey, `custom:${fieldKey}`, ...mapped];
  }

  function isSeedFieldKey(fieldKey: string): boolean {
    return options.systemFieldKeys.has(fieldKey);
  }

  function getFieldRemovalIssues(input: ModuleFieldDependencyInput): ModuleFieldDependencyIssue[] {
    const { fieldKey, columnRegistry } = input;
    const issues: ModuleFieldDependencyIssue[] = [];

    if (isSeedFieldKey(fieldKey)) {
      issues.push({
        area: "systemField",
        messageKey: options.messageKeys.systemField,
      });
      return issues;
    }

    const columnKeys = new Set(columnKeysForField(fieldKey));
    const column = columnRegistry.find((col) => columnKeys.has(col.key) && col.enabled !== false);
    if (column) {
      issues.push({
        area: "column",
        messageKey: options.messageKeys.fieldUsedInColumn,
      });
    }

    return issues;
  }

  return { isSeedFieldKey, getFieldRemovalIssues };
}
