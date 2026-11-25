import { getStudentsHost } from "../host.js";

export type BrandingInfo = any;
export type InvoiceTemplate = any;
export type StudentCardTemplate = any;

export function getInvoiceTemplateStore(..._args: any[]): any {
  return (getStudentsHost() as any).invoiceTemplateStore;
}
