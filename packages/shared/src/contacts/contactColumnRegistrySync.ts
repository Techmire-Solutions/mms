import type { ColumnRegistryEntry, FieldDefinition } from "./contactFieldSchemaTypes.js";
import { COLUMN_FIELD_MAPPING, DEFAULT_COLUMN_REGISTRY } from "./contactTabRegistry.js";
import { CONTACT_LOCKED_ENABLED_TABS } from "./contactEnabledTabs.js";
import { syncModuleColumnRegistryWithFields } from "../settings/moduleColumnRegistrySync.js";
import { listEnabledCustomContactFormFields } from "./contactFormCustomFields.js";

/**
 * Aligns `columnRegistry.enabled` with Setup Fields tab/field enablement.
 * Mapped columns for disabled tabs/fields are forced off; when active again they
 * restore the default registry enabled flag (custom columns keep stored enabled).
 */
export function syncContactColumnRegistryWithFields(
  columnRegistry: ColumnRegistryEntry[] | undefined,
  fields: Record<string, FieldDefinition[]>,
  enabledTabIds: Iterable<string>,
): ColumnRegistryEntry[] {
  return syncModuleColumnRegistryWithFields({
    defaultRegistry: DEFAULT_COLUMN_REGISTRY,
    columnFieldMapping: COLUMN_FIELD_MAPPING,
    lockedEnabledTabs: CONTACT_LOCKED_ENABLED_TABS,
    columnRegistry,
    fields,
    enabledTabIds,
    listEnabledCustomFields: listEnabledCustomContactFormFields,
  });
}
