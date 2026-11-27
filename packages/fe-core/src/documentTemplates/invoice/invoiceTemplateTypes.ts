import type { BrandingSettings } from "@mms/contracts";
import {
  translateApp,
  type AppTranslationKey,
  PAGE_SIZES,
  getPageDimensions,
  pageSizeKeySchema,
  templateOrientationSchema,
  elementStyleSchema,
  templateElementSchema,
  templateElementTypeSchema,
  templateTableColumnSchema,
  templateTableConfigSchema,
  documentTemplateSchema,
  isRtlText,
  type PageSizeInfo,
  type PageSizeKey,
  type ElementStyle,
  type TemplateElement,
  type TemplateElementType,
  type TemplateOrientation,
  type TemplateTableColumn,
  type TemplateTableConfig,
  type DocumentTemplate,
  type TemplateFieldDefinition,
  type DocumentTemplatePreset,
} from "@mms/contracts";

export {
  PAGE_SIZES,
  getPageDimensions,
  pageSizeKeySchema,
  templateOrientationSchema,
  elementStyleSchema,
  templateElementSchema,
  templateElementTypeSchema,
  templateTableColumnSchema,
  templateTableConfigSchema,
  documentTemplateSchema,
  isRtlText,
};

export type {
  PageSizeInfo,
  PageSizeKey,
  ElementStyle,
  TemplateElement,
  TemplateElementType,
  TemplateOrientation,
  TemplateTableColumn,
  TemplateTableConfig,
  DocumentTemplate,
  TemplateFieldDefinition,
  DocumentTemplatePreset,
};

/**
 * Standard well-known receipt field identifiers available in the obligation template engine.
 */
export type StandardInvoiceField =
  | "receipt_no"
  | "received_date"
  | "received_by"
  | "sender"
  | "sender_phone"
  | "sender_email"
  | "reference"
  | "reference_phone"
  | "reference_email"
  | "obligation_type"
  | "mujtahid"
  | "representative"
  | "amount"
  | "amount_in_words"
  | "currency"
  | "payment_mode"
  | "institution_name"
  | "institution_phone"
  | "institution_email"
  | "institution_address";

/**
 * Field key for invoice elements. Combines strongly-typed standard keys with
 * an open-ended string union for dynamic custom fields.
 */
export type InvoiceTemplateFieldKey = StandardInvoiceField | (string & {});

/**
 * Strongly typed payload representing data passed into the invoice template renderer.
 */
export interface InvoiceReceiptPayload {
  receipt_no: string;
  received_date: string;
  received_by: string;
  sender: string;
  sender_phone?: string;
  sender_email?: string;
  reference?: string;
  reference_phone?: string;
  reference_email?: string;
  obligation_type: string;
  mujtahid?: string;
  representative?: string;
  amount: string;
  amount_in_words: string;
  currency: string;
  payment_mode?: string;
  institution_name?: string;
  institution_phone?: string;
  institution_email?: string;
  institution_address?: string;
  [customField: string]: unknown;
}

export type InvoiceTemplate = DocumentTemplate<InvoiceReceiptPayload>;
export type BrandingInfo = BrandingSettings;

export interface LookupItem {
  id: string | number;
  name?: string;
  code?: string;
  mujtahid_id?: string | number;
  phone?: string | null;
  email?: string | null;
}

export interface FieldLookupInfo {
  contacts?: LookupItem[];
  users?: LookupItem[];
  obligationTypes?: LookupItem[];
  mujtahids?: LookupItem[];
  reps?: LookupItem[];
  currencies?: LookupItem[];
  branding?: Partial<BrandingInfo>;
}

/**
 * Resolves a translation key to a localized string, falling back to the
 * provided English default when the key is missing. Defaults to identity so
 * pure/non-React callers (tests, store snapshot) keep English labels.
 */
/**
 * Translator passed into the element/preset builders.
 *
 * Single-argument on purpose: the previous `(key, fallback)` shape invited
 * `t(key) || 'English label'`, which `.cursor/rules/mms-settings-i18n.mdc` bans. Every
 * key these builders use exists in all four locale packs (asserted by
 * `pnpm check:i18n`), so an English fallback was dead code that silently masked a
 * missing translation.
 */
export type TemplateTranslate = (key: string) => string;

/**
 * Default translator for non-React callers — the persistence/store snapshots and the
 * default template fallback, which have no translation provider and must still produce
 * a language-stable document.
 *
 * It resolves the **English pack from the shared catalog**, the same SSOT the running
 * app uses, instead of an inline English literal: the 24 strings these builders emit
 * were previously written twice (once as a hardcoded fallback here, once in
 * `appTranslationsEn.ts`) and the copies had to be kept in sync by hand.
 */
export const defaultTemplateTranslate: TemplateTranslate = (key) =>
  translateApp(key as AppTranslationKey, "en");

/** i18n key namespace for palette field labels. */
export const INVOICE_TEMPLATE_FIELD_KEY_PREFIX = "obligations.invoiceTemplate.field.";

/** i18n key namespace for baked-in template (static) labels. */
export const INVOICE_TEMPLATE_STATIC_KEY_PREFIX = "obligations.invoiceTemplate.static.";

export interface IndexedFieldLookups {
  contacts?: Map<string, LookupItem>;
  users?: Map<string, LookupItem>;
  obligationTypes?: Map<string, LookupItem>;
  mujtahids?: Map<string, LookupItem>;
  reps?: Map<string, LookupItem>;
  currencies?: Map<string, LookupItem>;
  branding?: FieldLookupInfo["branding"];
}
