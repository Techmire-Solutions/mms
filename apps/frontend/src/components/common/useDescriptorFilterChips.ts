/**
 * @file useDescriptorFilterChips.ts
 * @description Derives FilterChip[] from an entity descriptor + active filter map (SSOT).
 */

import { useMemo } from "react";
import type { EntityDescriptor, FieldDefinition } from "@/components/common/entityRegistryTypes";
import type { FilterChip } from "@/components/app/FilterChips";

/**
 * Derives a stable `FilterChip[]` array from an SSOT entity descriptor and
 * an active filter state map.
 *
 * Eligible fields: `filterable: true`, or badge/status fields with `badgeVariantMap`.
 * Array filter values emit one chip per element; `onRemove(key, value)` receives the value.
 *
 * @param descriptor - i18n-resolved EntityDescriptor for the entity
 * @param filters    - The current active filter state (key → filter value or string[])
 * @param onRemove   - Called with the field key (and optional value for array filters)
 */
export function useDescriptorFilterChips<TEntity>(
  descriptor: EntityDescriptor<TEntity> | undefined,
  filters: Record<string, unknown>,
  onRemove: (fieldKey: string, value?: string) => void,
): FilterChip[] {
  return useMemo(() => {
    if (!descriptor) return [];

    const chips: FilterChip[] = [];

    for (const field of descriptor.fields) {
      if (!isFilterableField(field)) continue;

      const value = filters[field.key];
      if (value === undefined || value === null || value === "") continue;

      if (Array.isArray(value)) {
        for (const item of value) {
          if (item === undefined || item === null || item === "") continue;
          const stringValue = String(item);
          chips.push({
            key: `${field.key}:${stringValue}`,
            label: chipLabel(field, stringValue),
            onRemove: () => onRemove(field.key, stringValue),
          });
        }
        continue;
      }

      const stringValue = String(value);
      chips.push({
        key: field.key,
        label: chipLabel(field, stringValue),
        onRemove: () => onRemove(field.key),
      });
    }

    return chips;
  }, [descriptor, filters, onRemove]);
}

function chipLabel<T>(field: FieldDefinition<T>, stringValue: string): string {
  const badgeConfig = field.badgeVariantMap?.[stringValue];
  return badgeConfig?.label
    ? `${field.label}: ${badgeConfig.label}`
    : `${field.label}: ${stringValue}`;
}

/** Fields eligible for chip generation. */
function isFilterableField<T>(field: FieldDefinition<T>): boolean {
  if (field.filterable !== undefined) return field.filterable;
  return (field.type === "badge" || field.type === "status") && field.badgeVariantMap !== undefined;
}
