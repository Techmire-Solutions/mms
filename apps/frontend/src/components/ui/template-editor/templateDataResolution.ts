/**
 * @file templateDataResolution.ts
 * @description Pure resolution of what a template element shows: text, table rows, QR
 * payload and writing direction. Shared by the editor canvas and the print renderer —
 * the two used to disagree on all four, which is why a table could print as the word
 * "Table" and Arabic text could print left-aligned.
 *
 * Split out of `templateElementContent.tsx` (pure logic vs. JSX) to stay under the
 * repository's 300-line-per-file ceiling.
 */

import { isRtlText } from "@mms/shared";
import type { ElementStyle, TemplateElement } from "@mms/shared";

/** Placeholder line items shown when the document has no row data. */
export const TABLE_FALLBACK_ROWS: Record<string, unknown>[] = [
  { id: "1", description: "Tuition / Fee Item 1", amount: "300.00" },
  { id: "2", description: "Syllabus / Materials", amount: "100.00" },
  { id: "3", description: "Activity & Facilities", amount: "50.00" },
];

export type TemplateRenderMode = "edit" | "preview" | "print";

export interface ElementGeometry {
  /** Resolved writing direction for the element. */
  direction: "ltr" | "rtl";
  /** Resolved text alignment. */
  textAlign: "left" | "center" | "right";
}

/**
 * Direction defaults are shared so the canvas and the printed page agree: explicit
 * style wins, then script detection, then the application's own direction (an Urdu
 * workspace should not have to set direction on every element by hand).
 */
export function resolveElementGeometry(
  el: TemplateElement,
  appDir: "ltr" | "rtl" = "ltr",
  text = "",
): ElementGeometry {
  const st = (el.style || {}) as ElementStyle;
  const isArabicScript = isRtlText(text || el.label || "");
  const direction =
    (st.direction as "ltr" | "rtl" | undefined) || (isArabicScript ? "rtl" : appDir);
  const textAlign =
    (st.textAlign as "left" | "center" | "right" | undefined) ||
    (direction === "rtl" ? "right" : "left");
  return { direction, textAlign };
}

/**
 * Resolves the text a text-bearing element displays.
 *
 * `data` is a flat field→value record in both callers: the editor passes the sample
 * payload it already resolved from the live record, the print path passes the value
 * `resolveField` produced for the same record.
 */
export function resolveElementText(
  el: TemplateElement,
  data: Record<string, unknown> | null | undefined,
  mode: TemplateRenderMode,
  interpolate: (text: string, data: Record<string, unknown>) => string,
): string {
  const fieldKey = el.field ? String(el.field) : "";
  if (el.type === "field" && fieldKey) {
    const raw = data ? data[fieldKey] : undefined;
    if (raw != null && String(raw).trim() !== "") return String(raw);
    // The editor shows the binding so a designer can see an empty state; a printed
    // document must not print "{receipt_no}".
    return mode === "edit" ? `{${fieldKey}}` : "";
  }
  const label = el.label || "";
  if (data && label) return interpolate(label, data);
  return label;
}

/**
 * Row data for a table element: the first array found in the payload, or `null` when
 * the payload carries no rows at all.
 *
 * `null` is deliberately distinct from an empty array so callers can decide what to do:
 * the editor shows placeholder rows (a designer needs to see the layout), while print
 * shows none — a printed receipt must never invent "Tuition / Fee Item 1".
 */
export function resolveTableRows(
  el: TemplateElement,
  data: Record<string, unknown> | null | undefined,
): Record<string, unknown>[] | null {
  if (el.type !== "table" || !data || typeof data !== "object") return null;
  for (const key of Object.keys(data)) {
    const value = data[key];
    if (Array.isArray(value) && value.length > 0) {
      return value as Record<string, unknown>[];
    }
  }
  return null;
}

/**
 * How many table rows actually fit in the element box. Shared by both renderers so
 * the printed page shows the same rows the designer saw (`slice(0, 4)` in the editor
 * vs. nothing at all in print was the previous state of affairs).
 */
export function visibleTableRowCount(el: TemplateElement): number {
  const rowHeight = el.tableConfig?.rowHeight || 22;
  const headerHeight = el.tableConfig?.showHeader === false ? 0 : rowHeight + 8;
  const available = Math.max(0, el.h - headerHeight);
  const rows = Math.floor(available / rowHeight);
  return rows > 0 ? rows : 1;
}

/**
 * QR payload resolution, shared by the canvas and the printed page.
 *
 * Order: an explicitly resolved payload (the print path builds a receipt verification
 * URL from the live record) → a bound field value → the element label → the caller's
 * placeholder. The editor had its own rule here and the print path had another, so the
 * QR code an admin positioned was not the QR code that printed.
 */
export function resolveQrPayload(
  el: TemplateElement,
  data: Record<string, unknown> | null | undefined,
  options: { explicitPayload?: string | null; qrCodeLabel: string; placeholder: string },
): string {
  const fieldKey = el.field ? String(el.field) : "";
  if (fieldKey && data) {
    const value = data[fieldKey];
    if (value != null && String(value).trim() !== "") return String(value);
  }
  if (options.explicitPayload) return options.explicitPayload;
  const { qrCodeLabel, placeholder } = options;
  if (el.label && el.label !== qrCodeLabel && el.label !== "QR Code") return el.label;
  return placeholder;
}
