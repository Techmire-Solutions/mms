import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type FieldValueType =
  | "text"
  | "number"
  | "currency"
  | "date"
  | "datetime"
  | "badge"
  | "link"
  | "status"
  | "boolean"
  | "phone"
  | "email";

export type BadgeTone =
  | "default"
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "danger"
  | "destructive"
  | "info"
  | "muted";

export interface FieldBadgeConfig {
  label?: string;
  tone?: BadgeTone;
  className?: string;
}

export interface FieldDefinition<T> {
  key: string;
  labelKey?: string;
  label: string;
  type: FieldValueType;
  icon?: LucideIcon;
  sortable?: boolean;
  filterable?: boolean;
  filterPreset?: boolean;
  defaultVisibleInTable?: boolean;
  tableOrder?: number;
  fixed?: boolean;
  cardSlot?: "primary" | "secondary" | "meta" | "badge" | "hidden";
  showInCardGrid?: boolean;
  drawerSection?: string;
  drawerOrder?: number;
  hideInDrawer?: boolean;
  badgeVariantMap?: Record<string, FieldBadgeConfig>;
  currencyCode?: string;
  ariaLabel?: string | ((value: unknown, entity: T) => string);
  accessor?: (entity: T) => unknown;
  formatValue?: (value: unknown, entity: T) => string;
  renderValue?: (entity: T) => ReactNode;
}

export interface EntityDrawerSection<T> {
  id: string;
  title: string;
  fields: FieldDefinition<T>[];
}

export interface TableColumnDescriptor {
  id: string;
  label: string;
  order: number;
  enabled: boolean;
  fixed?: boolean;
}

export interface EntityDescriptor<T> {
  entityType: string;
  singularLabel: string;
  pluralLabel: string;
  idField: keyof T | string;
  titleField: keyof T | string;
  fields: FieldDefinition<T>[];
  getField: (key: string) => FieldDefinition<T> | undefined;
  getTableColumns: () => TableColumnDescriptor[];
  getCardFields: () => FieldDefinition<T>[];
  getDrawerSections: () => EntityDrawerSection<T>[];
  /** Returns the raw (pre-format) value for a field key — respects `accessor` if defined. */
  getRawValue: (fieldKey: string, entity: T) => unknown;
  formatFieldValue: (fieldKey: string, entity: T) => string;
  renderFieldValue: (fieldKey: string, entity: T) => ReactNode;
}

export interface CreateEntityDescriptorOptions<T> {
  entityType: string;
  singularLabel: string;
  pluralLabel: string;
  idField: keyof T | string;
  titleField: keyof T | string;
  fields: FieldDefinition<T>[];
  /** Fallback label for drawer sections auto-generated from the "general" section id. */
  defaultDrawerSectionTitle?: string;
  /**
   * Explicit title overrides for drawer section IDs.
   * Takes precedence over auto-capitalization and `defaultDrawerSectionTitle`.
   * @example { identity: 'Personal Identity', contact: 'Contact Details' }
   */
  sectionTitleMap?: Record<string, string>;
}
