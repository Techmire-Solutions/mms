import type { ReactNode } from "react";
import type {
  FieldDefinition,
  EntityDrawerSection,
  TableColumnDescriptor,
  EntityDescriptor,
  CreateEntityDescriptorOptions,
} from "@/components/common/entityRegistryTypes";
import { formatFieldValueDefault, renderFieldValueDefault } from "./entityDescriptorRenderers";

export function createEntityDescriptor<T>(
  options: CreateEntityDescriptorOptions<T>,
): EntityDescriptor<T> {
  const {
    entityType,
    singularLabel,
    pluralLabel,
    idField,
    titleField,
    fields,
    defaultDrawerSectionTitle = "General Details",
    sectionTitleMap,
  } = options;

  const fieldMap = new Map<string, FieldDefinition<T>>();
  fields.forEach((field) => fieldMap.set(field.key, field));

  const getField = (key: string): FieldDefinition<T> | undefined => fieldMap.get(key);

  const getTableColumns = (): TableColumnDescriptor[] => {
    return fields
      .map((field, index) => ({
        id: field.key,
        label: field.label,
        order: field.tableOrder ?? (index + 1) * 10,
        enabled: field.defaultVisibleInTable ?? true,
        fixed: field.fixed ?? false,
      }))
      .sort((a, b) => a.order - b.order);
  };

  const getCardFields = (): FieldDefinition<T>[] => {
    return fields.filter((field) => field.showInCardGrid !== false && field.cardSlot !== "hidden");
  };

  const getDrawerSections = (): EntityDrawerSection<T>[] => {
    const sectionMap = new Map<string, FieldDefinition<T>[]>();
    const drawerFields = fields
      .filter((field) => !field.hideInDrawer)
      .sort((a, b) => (a.drawerOrder ?? 999) - (b.drawerOrder ?? 999));

    for (const field of drawerFields) {
      const sectionId = field.drawerSection || "general";
      if (!sectionMap.has(sectionId)) {
        sectionMap.set(sectionId, []);
      }
      sectionMap.get(sectionId)?.push(field);
    }

    return Array.from(sectionMap.entries()).map(([id, sectionFields]) => {
      let title: string;
      if (sectionTitleMap?.[id]) {
        title = sectionTitleMap[id]!;
      } else if (id === "general") {
        title = defaultDrawerSectionTitle;
      } else {
        title = id.charAt(0).toUpperCase() + id.slice(1);
      }
      return { id, title, fields: sectionFields };
    });
  };

  const getRawValue = (fieldKey: string, entity: T): unknown => {
    const field = getField(fieldKey);
    if (!field) return (entity as Record<string, unknown>)[fieldKey];
    if (field.accessor) return field.accessor(entity);
    return (entity as Record<string, unknown>)[fieldKey];
  };

  const formatFieldValue = (fieldKey: string, entity: T): string => {
    const field = getField(fieldKey);
    const rawValue = getRawValue(fieldKey, entity);
    return formatFieldValueDefault(field, rawValue, entity);
  };

  const renderFieldValue = (fieldKey: string, entity: T): ReactNode => {
    const field = getField(fieldKey);
    const rawValue = getRawValue(fieldKey, entity);
    const formatted = formatFieldValue(fieldKey, entity);
    return renderFieldValueDefault(field, rawValue, entity, fieldKey, formatted);
  };

  return {
    entityType,
    singularLabel,
    pluralLabel,
    idField,
    titleField,
    fields,
    getField,
    getTableColumns,
    getCardFields,
    getDrawerSections,
    getRawValue,
    formatFieldValue,
    renderFieldValue,
  };
}
