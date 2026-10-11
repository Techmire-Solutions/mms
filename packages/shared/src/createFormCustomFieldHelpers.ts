import type { FieldDefinition } from "./contactFieldSchemaTypes.js";

export interface ModuleFormCustomFieldHelpers {
  listSystemFormFieldKeys: () => ReadonlySet<string>;
  listEnabledCustomFormFields: <T extends FieldDefinition>(
    fields: Record<string, ReadonlyArray<T>>,
    tabId?: string,
  ) => ReadonlyArray<T>;
  isSystemFormField: (tabId: string, fieldId: string) => boolean;
}

/**
 * Shared form custom-field helpers over a static module field seed.
 * Faculty/Students adapters pass their seed ({@link INITIAL_FACULTY_FIELD_SEED} /
 * {@link INITIAL_STUDENT_FIELD_SEED}).
 */
export function createFormCustomFieldHelpers(
  seed: Record<string, FieldDefinition[]>,
): ModuleFormCustomFieldHelpers {
  function listSystemFormFieldKeys(): ReadonlySet<string> {
    const keys = new Set<string>();
    for (const tabFields of Object.values(seed)) {
      for (const field of tabFields) {
        keys.add(field.key);
      }
    }
    return keys;
  }

  function listEnabledCustomFormFields<T extends FieldDefinition>(
    fields: Record<string, ReadonlyArray<T>>,
    tabId?: string,
  ): ReadonlyArray<T> {
    const systemKeys = listSystemFormFieldKeys();
    const byKey = new Map<string, T>();
    const sourceTabs: ReadonlyArray<ReadonlyArray<T>> =
      tabId != null ? [fields[tabId] ?? []] : Object.values(fields);

    for (const tabFields of sourceTabs) {
      if (!tabFields || !Array.isArray(tabFields)) continue;
      for (const field of tabFields) {
        if (!field.enabled || systemKeys.has(field.key)) continue;
        if (!byKey.has(field.key)) {
          byKey.set(field.key, field);
        }
      }
    }

    return [...byKey.values()].sort((left, right) => {
      const leftOrder = Number(
        (left as { order?: number; sortOrder?: number }).sortOrder ??
          (left as { order?: number }).order ??
          0,
      );
      const rightOrder = Number(
        (right as { order?: number; sortOrder?: number }).sortOrder ??
          (right as { order?: number }).order ??
          0,
      );
      const orderDelta = leftOrder - rightOrder;
      return orderDelta !== 0 ? orderDelta : left.key.localeCompare(right.key);
    });
  }

  function isSystemFormField(tabId: string, fieldId: string): boolean {
    return (seed[tabId] ?? []).some((field) => field.key === fieldId);
  }

  return { listSystemFormFieldKeys, listEnabledCustomFormFields, isSystemFormField };
}
