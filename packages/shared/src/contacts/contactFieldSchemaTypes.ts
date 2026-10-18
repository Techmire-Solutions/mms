/** Contact field/tab/column schema types and preference contracts. */
import type { AppTranslationKey } from "../i18n/appTranslations.js";
import type { RelationshipPair } from "./contactEntityTypes.js";

/** Schema metadata for dynamic custom and standard contact fields. */
export interface FieldDefinition {
  key: string;
  label: string;
  /** i18n key for system fields; custom fields use `label` directly. */
  labelKey?: AppTranslationKey;
  type:
    | "text"
    | "textarea"
    | "number"
    | "date"
    | "datetime"
    | "select"
    | "multiselect"
    | "single_select"
    | "multi_select"
    | "tags"
    | "boolean"
    | "url"
    | "email"
    | "file"
    | "location"
    | "ai_summary"
    | "currency";
  enabled: boolean;
  order: number;
  options?: string[];
  permissions?: string[];
  defaultValue?: unknown;
  required?: boolean;
  unique?: boolean;
  placeholder?: string;
  description?: string;
  /** i18n key for system field descriptions; custom fields use `description` directly. */
  descriptionKey?: AppTranslationKey;
  group?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  mask?: string;
  precision?: number;
}

/** Tab specification entry for module layout customization. */
export interface TabDefinition {
  key: string;
  label: string;
  /** i18n key for system tabs; custom tabs use `label` directly. */
  labelKey?: AppTranslationKey;
  icon?: string;
  enabled: boolean;
  order: number;
  permissions?: string[];
  description?: string;
  color?: string;
  isSystem?: boolean;
}

/** Column registry configuration for contact directory tables. */
export interface ColumnRegistryEntry {
  key: string;
  label: string;
  /** i18n key for system columns; custom columns use `label` directly. */
  labelKey?: AppTranslationKey;
  enabled: boolean;
  order: number;
  sortable?: boolean;
  width?: number; // px, 0 = auto
  sortField?: string; // field key to sort by
  fixed?: boolean;
}

/** Complete field configuration envelope governing standard and custom field definitions. */
export interface FieldConfig {
  version: number;
  enabledTabs: string[];
  requiredTabs: string[];
  fields: Record<string, FieldDefinition[]>;
  pageTabs?: TabDefinition[];
  formTabs?: TabDefinition[];
  detailTabs?: TabDefinition[];
  settingsSubTabs?: TabDefinition[];
  defaultRating?: number;
  columnRegistry?: ColumnRegistryEntry[];
}

/** Tenant and user preferences for contact views, defaults, and duplicate scoring thresholds. */
export type ContactPreferences = {
  defaultCountry?: string;
  defaultProvince?: string;
  defaultCity?: string;
  defaultViewLayout?: string;
  namePrefixesToIgnore?: string[];
  duplicateDetectionFields?: string[];
  duplicateDetectionThresholdHigh?: number;
  duplicateDetectionThresholdMedium?: number;
  duplicateDetectionColorHigh?: string;
  duplicateDetectionColorMedium?: string;
  duplicateDetectionColorLow?: string;
  duplicateDetectionScorePhoneEmail?: number;
  duplicateDetectionScoreNamePhone?: number;
  duplicateDetectionScoreNameEmail?: number;
  duplicateDetectionScorePhone?: number;
  duplicateDetectionScoreEmail?: number;
  duplicateDetectionScoreName?: number;
  duplicateDetectionScoreDefault?: number;
  duplicateDetectionColorWarning?: string;
  duplicateDetectionColorWarningText?: string;
  duplicateDetectionColorSuccess?: string;
  duplicateDetectionColorSuccessText?: string;
  duplicateDetectionColorHighlight?: string;
  showDetailedSolarAge?: boolean;
  showLunarDob?: boolean;
  showDetailedLunarAge?: boolean;
  relationshipPairs?: RelationshipPair[];
  /** Preferred Relationship-type dropdown order (subset of pair-derived labels). */
  relationshipOptionOrder?: string[];
};

/** WhatsApp quick template preset for campaign messaging. */
export interface WhatsAppTemplate {
  id: string;
  label: string;
  body: string;
}
