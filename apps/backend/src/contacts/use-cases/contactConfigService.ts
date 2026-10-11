import {
  migrateEmergencyTabToRelationship,
  type FieldConfig,
  type TabDefinition,
} from "@mms/shared";
import { createModuleFieldConfigService } from "../../lib/createModuleFieldConfigService.js";
import {
  getContactFieldConfigByWorkspace,
  upsertContactFieldConfig,
} from "../../db/repositories/contactFieldConfigRepository.js";

function stripFormTabs(config: FieldConfig): Record<string, unknown> {
  const { formTabs: _formTabs, ...rest } = config;
  return rest as Record<string, unknown>;
}

function asFieldConfig(raw: Record<string, unknown>): FieldConfig {
  return {
    version: typeof raw.version === "number" ? raw.version : 1,
    enabledTabs: Array.isArray(raw.enabledTabs) ? (raw.enabledTabs as string[]) : [],
    requiredTabs: Array.isArray(raw.requiredTabs) ? (raw.requiredTabs as string[]) : [],
    fields:
      raw.fields && typeof raw.fields === "object" && !Array.isArray(raw.fields)
        ? (raw.fields as FieldConfig["fields"])
        : {},
    pageTabs: Array.isArray(raw.pageTabs) ? raw.pageTabs : undefined,
    formTabs: Array.isArray(raw.formTabs) ? raw.formTabs : undefined,
    detailTabs: Array.isArray(raw.detailTabs) ? raw.detailTabs : undefined,
    settingsSubTabs: Array.isArray(raw.settingsSubTabs) ? raw.settingsSubTabs : undefined,
    defaultRating: typeof raw.defaultRating === "number" ? raw.defaultRating : undefined,
    columnRegistry: Array.isArray(raw.columnRegistry) ? raw.columnRegistry : undefined,
  };
}

const contactFieldConfig = createModuleFieldConfigService<
  Record<string, unknown>,
  FieldConfig,
  TabDefinition,
  FieldConfig["fields"],
  Record<string, unknown>
>({
  broadcastKey: "contacts",
  getByWorkspace: getContactFieldConfigByWorkspace,
  upsert: upsertContactFieldConfig,
  toDocument: (raw) => migrateEmergencyTabToRelationship(asFieldConfig(raw)),
  stripForPersist: stripFormTabs,
  reloadFailedMessage: "Failed to reload contact field config after save",
});

export const loadContactFieldConfig = contactFieldConfig.load;

export async function saveContactFieldConfig(
  config: FieldConfig | Record<string, unknown>,
): Promise<FieldConfig> {
  return contactFieldConfig.save(asFieldConfig(config as Record<string, unknown>));
}
