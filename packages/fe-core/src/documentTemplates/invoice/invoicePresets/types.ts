import type { InvoiceTemplate } from "../invoiceTemplateTypes";

export interface InvoiceTemplatePreset {
  key: string;
  nameKey: string;
  template: InvoiceTemplate;
}
