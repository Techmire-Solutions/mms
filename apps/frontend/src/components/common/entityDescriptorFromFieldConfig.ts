import type { FieldDefinition as RegistryFieldDefinition } from "@mms/shared";
import type {
  EntityDescriptor,
  FieldBadgeConfig,
  FieldDefinition as DescriptorFieldDefinition,
  FieldValueType,
} from "@/components/common/entityRegistryTypes";
import { createEntityDescriptor } from "./entityDescriptorFactory";

export type { FieldBadgeConfig };

const REGISTRY_TYPE_TO_VALUE_TYPE: Record<RegistryFieldDefinition["type"], FieldValueType> = {
  text: "text",
  textarea: "text",
  number: "number",
  currency: "currency",
  date: "date",
  datetime: "datetime",
  select: "badge",
  single_select: "badge",
  multiselect: "text",
  multi_select: "text",
  tags: "text",
  boolean: "boolean",
  url: "link",
  email: "email",
  file: "text",
  location: "text",
  ai_summary: "text",
};

/** Map a shared registry field type to a descriptor value type (parity-safe default "text"). */
export function mapRegistryFieldType(type: RegistryFieldDefinition["type"]): FieldValueType {
  return REGISTRY_TYPE_TO_VALUE_TYPE[type] ?? "text";
}

export interface CreateEntityDescriptorFromFieldConfigOptions<T> {
  entityType: string;
  singularLabel: string;
  pluralLabel: string;
  idField: keyof T | string;
  titleField: keyof T | string;
  /** Runtime module field config (tab id → fields), e.g. contacts `fields` from ContactConfig. */
  fieldsByTab: Record<string, RegistryFieldDefinition[]>;
  /** i18n label resolver — registry labels must never be hardcoded (mms-fields.md §3). */
  resolveLabel: (field: RegistryFieldDefinition) => string;
  /** Drawer section titles by tab id (defaults to the tab id capitalized by the factory). */
  sectionTitleMap?: Record<string, string>;
  /** Permission filter — exclude fields the viewer cannot see (e.g. canViewContactField). */
  canViewField?: (field: RegistryFieldDefinition) => boolean;
  /** Per-field descriptor overrides (type, badgeVariantMap, accessor, renderValue, cardSlot, …). */
  fieldOverrides?: Record<string, Partial<DescriptorFieldDefinition<T>>>;
}

/**
 * Build an EntityDescriptor from a runtime module FieldConfig so descriptor-driven
 * surfaces stay SSOT with the tenant registry (custom fields, permissions, i18n intact).
 */
export function createEntityDescriptorFromFieldConfig<T>(
  options: CreateEntityDescriptorFromFieldConfigOptions<T>,
): EntityDescriptor<T> {
  const fields: DescriptorFieldDefinition<T>[] = Object.entries(options.fieldsByTab)
    .flatMap(([tabId, tabFields]) =>
      (tabFields ?? [])
        .filter(
          (field) => field.enabled && (options.canViewField ? options.canViewField(field) : true),
        )
        .map(
          (field) =>
            ({
              key: field.key,
              label: options.resolveLabel(field),
              labelKey: field.labelKey,
              type: mapRegistryFieldType(field.type),
              defaultVisibleInTable: true,
              tableOrder: (field.order + 1) * 10,
              cardSlot: "meta",
              drawerSection: tabId,
              drawerOrder: field.order,
              ...(options.fieldOverrides?.[field.key] ?? {}),
            }) satisfies DescriptorFieldDefinition<T>,
        ),
    )
    .sort((a, b) => (a.drawerOrder ?? 999) - (b.drawerOrder ?? 999));

  return createEntityDescriptor<T>({
    entityType: options.entityType,
    singularLabel: options.singularLabel,
    pluralLabel: options.pluralLabel,
    idField: options.idField,
    titleField: options.titleField,
    fields,
    sectionTitleMap: options.sectionTitleMap,
  });
}
