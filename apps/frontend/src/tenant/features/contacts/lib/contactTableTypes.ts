import type React from "react";
import type { ContactsColumnConfig } from "@/lib/contacts/contactConfigContextTypes";

export type { ContactsColumnConfig };

/**
 * Returns fixed width CSS styles for table column sizing.
 *
 * @param width - Pixel width of the column, or undefined.
 * @returns CSSProperties with width, minWidth, maxWidth or undefined.
 */
export function columnWidthStyle(width: number | undefined): React.CSSProperties | undefined {
  if (typeof width !== "number" || width <= 0) return undefined;
  return { width, minWidth: width, maxWidth: width };
}
