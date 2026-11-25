import type { InvoiceTemplate } from "@/lib/invoiceTemplateTypes";

export interface InvoiceTemplatePreset {
  key: string;
  nameKey: string;
  template: InvoiceTemplate;
}
