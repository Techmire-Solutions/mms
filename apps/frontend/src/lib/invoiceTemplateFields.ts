/**
 * @file invoiceTemplateFields.ts
 * @description Obligations invoice template fields plus the resolver barrel.
 *
 * Split out of the deleted `invoiceTemplatePersistence` module: layouts are now read
 * and written through `/api/templates/:key`, but the field catalog and field resolver
 * remain pure and shared by the editor, the print preview and the sample data hook.
 */

import type { TemplateFieldDefinition } from "@mms/shared";
import type { IndexedFieldLookups, InvoiceReceiptPayload } from "./invoiceTemplateTypes";
import { indexLookups, resolveField } from "./invoiceTemplateResolver";

export type { IndexedFieldLookups };
export { indexLookups, resolveField };

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
