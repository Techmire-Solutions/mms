/**
 * @file templateEditorElementFactories.ts
 * @description Pure factory builders and collision-free layout insertion for template elements.
 */

import type { PageSizeInfo, TemplateElement, TemplateFieldDefinition } from "@mms/shared";
import { PRINT_NEUTRAL } from "@/lib/printBrandingTokens";
import { newId, snap } from "./templateEditorUtils";

/**
 * Finds a free spot for a new element on the canvas instead of stacking on top of existing elements.
 */
export function findInsertionPos(
  elements: readonly TemplateElement[],
  w: number,
  h: number,
  size: PageSizeInfo,
): { x: number; y: number } {
  const pad = 6;
  const overlaps = (x: number, y: number) =>
    elements.some(
      (el) =>
        x < el.x + el.w + pad && x + w + pad > el.x && y < el.y + el.h + pad && y + h + pad > el.y,
    );

  const x = 20;
  for (let y = 20; y + h <= size.height - 20; y += 10) {
    if (!overlaps(x, y)) return { x: snap(x), y: snap(y) };
  }

  const stagger = (elements.length % 6) * 16;
  return {
    x: snap(Math.min(Math.max(0, size.width - w - 20), 20 + stagger)),
    y: snap(Math.min(Math.max(0, size.height - h - 20), 20 + stagger)),
  };
}

export function createStaticTextElement(x: number, y: number, label: string): TemplateElement {
  return {
    id: newId(),
    type: "static",
    label,
    x,
    y,
    w: 200,
    h: 18,
    style: { fontSize: 11, color: PRINT_NEUTRAL.text },
  };
}

export function createHeadingElement(
  x: number,
  y: number,
  w: number,
  label: string,
): TemplateElement {
  return {
    id: newId(),
    type: "static",
    label,
    x,
    y,
    w,
    h: 26,
    style: { fontSize: 16, fontWeight: "bold", color: PRINT_NEUTRAL.text },
  };
}

export function createDividerElement(x: number, y: number, w: number): TemplateElement {
  return {
    id: newId(),
    type: "divider",
    label: "",
    x,
    y,
    w,
    h: 1,
    style: { color: PRINT_NEUTRAL.border },
  };
}

export function createFieldElement<TPayload = Record<string, unknown>>(
  x: number,
  y: number,
  fieldDef: TemplateFieldDefinition<TPayload>,
): TemplateElement<keyof TPayload & string> {
  return {
    id: newId(),
    type: "field",
    label: fieldDef.label,
    field: fieldDef.field,
    x,
    y,
    w: 160,
    h: 16,
    style: { fontSize: 10, color: PRINT_NEUTRAL.text },
  };
}

export function createQrCodeElement(x: number, y: number, label: string): TemplateElement {
  return {
    id: newId(),
    type: "qrcode",
    label,
    x,
    y,
    w: 64,
    h: 64,
  };
}

export function createLogoElement(x: number, y: number, label: string): TemplateElement {
  return {
    id: newId(),
    type: "logo",
    label,
    x,
    y,
    w: 80,
    h: 80,
  };
}

export interface TableElementLabels {
  label: string;
  columnIndex: string;
  columnDescription: string;
  columnAmount: string;
}

export function createTableElement(
  x: number,
  y: number,
  w: number,
  labels: TableElementLabels,
): TemplateElement {
  return {
    id: newId(),
    type: "table",
    label: labels.label,
    x,
    y,
    w,
    h: 120,
    columns: [
      { id: newId(), header: labels.columnIndex, field: "id", width: 40, align: "center" },
      {
        id: newId(),
        header: labels.columnDescription,
        field: "description",
        width: 220,
        align: "left",
      },
      { id: newId(), header: labels.columnAmount, field: "amount", width: 100, align: "right" },
    ],
    tableConfig: {
      showHeader: true,
      rowHeight: 24,
      zebra: true,
      borderColor: PRINT_NEUTRAL.border,
    },
    style: {
      fontSize: 10,
      color: PRINT_NEUTRAL.text,
      backgroundColor: "#ffffff",
      borderWidth: 1,
      borderColor: PRINT_NEUTRAL.border,
    },
  };
}
