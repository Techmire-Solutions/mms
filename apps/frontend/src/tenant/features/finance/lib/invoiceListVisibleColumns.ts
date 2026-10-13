import { getVisibleWorkColumns, type ModuleColumnRegistryEntry } from "@mms/shared";

/** Card-face Work columns for Finance invoices (rendered outside the metadata grid). */
export const INVOICE_CARD_FACE_COLUMN_IDS = new Set(["student", "invoice"]);

/** Visible Work columns in registry order (checkbox / actions stay outside). */
export function getInvoiceVisibleWorkColumns(
  columnRegistry: ModuleColumnRegistryEntry[],
  isColumnVisible: (key: string) => boolean,
  options?: { excludeFace?: boolean },
): ModuleColumnRegistryEntry[] {
  return getVisibleWorkColumns(columnRegistry, isColumnVisible, {
    excludeFace: options?.excludeFace ? INVOICE_CARD_FACE_COLUMN_IDS : undefined,
  });
}
