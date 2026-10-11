import { INVOICE_TEMPLATE_OBJECT_KEY, type TemplateFieldDefinition } from "@mms/shared";
import { createDocumentTemplateStore } from "./documentTemplatePersistence.js";
import { getDefaultTemplate } from "./invoiceTemplateDefaults.js";
import type {
  BrandingInfo,
  InvoiceTemplate,
  IndexedFieldLookups,
  InvoiceTemplateFieldKey,
  InvoiceReceiptPayload,
} from "./invoiceTemplateTypes.js";
import { indexLookups, resolveField } from "./invoiceTemplateResolver.js";

export type { IndexedFieldLookups, InvoiceTemplateFieldKey };
export { indexLookups, resolveField };

export const INVOICE_TEMPLATE_CHANGED_EVENT = "mms:invoice-template-changed";

export const invoiceTemplateDocumentStore = createDocumentTemplateStore<InvoiceReceiptPayload>({
  key: INVOICE_TEMPLATE_OBJECT_KEY,
  changedEvent: INVOICE_TEMPLATE_CHANGED_EVENT,
  documentName: "invoice",
});

/**
 * Loads the current invoice template configuration from local cache.
 * Falls back to default template if cached object is missing or corrupted.
 */
export function loadTemplate(branding?: BrandingInfo): InvoiceTemplate {
  return invoiceTemplateDocumentStore.load(getDefaultTemplate(branding));
}

/**
 * Saves/updates the current invoice template config after verifying structural validity.
 * Dispatches an update event for reactive subscribers.
 */
export function saveTemplate(tmpl: InvoiceTemplate): void {
  invoiceTemplateDocumentStore.save(tmpl);
}

/**
 * Resets local invoice template back to system defaults.
 */
export function resetTemplate(branding?: BrandingInfo): InvoiceTemplate {
  const defaultTmpl = getDefaultTemplate(branding);
  saveTemplate(defaultTmpl);
  return defaultTmpl;
}

export const AVAILABLE_FIELDS: TemplateFieldDefinition<InvoiceReceiptPayload>[] = [
  { field: "receipt_no", label: "Receipt No", category: "Receipt", sampleValue: "REC-2026-0042" },
  { field: "received_date", label: "Date", category: "Receipt", sampleValue: "2026-09-13" },
  { field: "received_by", label: "Received By", category: "Receipt", sampleValue: "Admin Office" },
  {
    field: "sender",
    label: "Received From",
    category: "Donor & Reference",
    sampleValue: "Muhammad Ali Raza",
  },
  {
    field: "sender_phone",
    label: "Sender Phone",
    category: "Donor & Reference",
    sampleValue: "+92 300 1234567",
  },
  {
    field: "sender_email",
    label: "Sender Email",
    category: "Donor & Reference",
    sampleValue: "ali.raza@example.com",
  },
  {
    field: "reference",
    label: "Reference",
    category: "Donor & Reference",
    sampleValue: "Sayyid Kazim Hosseini",
  },
  {
    field: "reference_phone",
    label: "Reference Phone",
    category: "Donor & Reference",
    sampleValue: "+92 321 9876543",
  },
  {
    field: "reference_email",
    label: "Reference Email",
    category: "Donor & Reference",
    sampleValue: "kazim.ref@example.com",
  },
  {
    field: "obligation_type",
    label: "Obligation Type",
    category: "Religious Authority",
    sampleValue: "Khums (Sahm-e-Imam)",
  },
  {
    field: "mujtahid",
    label: "Mujtahid",
    category: "Religious Authority",
    sampleValue: "Ayatullah al-Uzma Sistani",
  },
  {
    field: "representative",
    label: "Representative",
    category: "Religious Authority",
    sampleValue: "Maulana Baqir Zaidi",
  },
  { field: "amount", label: "Amount", category: "Financial", sampleValue: "PKR 75,000.00" },
  {
    field: "amount_in_words",
    label: "Amount in Words",
    category: "Financial",
    sampleValue: "Seventy Five Thousand Rupees Only",
  },
  { field: "currency", label: "Currency", category: "Financial", sampleValue: "PKR" },
  {
    field: "payment_mode",
    label: "Payment Mode",
    category: "Financial",
    sampleValue: "Bank Transfer",
  },
  {
    field: "institution_name",
    label: "Institution Name",
    category: "Institution",
    sampleValue: "Madrasa Al-Huda",
  },
  {
    field: "institution_phone",
    label: "Institution Phone",
    category: "Institution",
    sampleValue: "+92 21 34567890",
  },
  {
    field: "institution_email",
    label: "Institution Email",
    category: "Institution",
    sampleValue: "office@alhuda.edu",
  },
  {
    field: "institution_address",
    label: "Institution Address",
    category: "Institution",
    sampleValue: "123 Seminary Road, Karachi",
  },
];
