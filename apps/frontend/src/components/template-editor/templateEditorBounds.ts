/**
 * @file templateEditorBounds.ts
 * @description Keeps an element's box on the printable page.
 *
 * Typed inspector values (X/Y/W/H) used to clamp only their floor, so an element could
 * be pushed past the paper edge and silently disappear from the printed document.
 */

import type { PageSizeInfo } from "@mms/shared";

export interface ElementBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Minimum element size the editor allows (matches drag/resize). */
export const MIN_ELEMENT_WIDTH = 20;
export const MIN_ELEMENT_HEIGHT = 4;

/** Clamps size to the page, then position so the element stays fully on it. */
export function clampElementBox<T extends ElementBox>(box: T, size: PageSizeInfo): T {
  const w = Math.min(size.width, Math.max(MIN_ELEMENT_WIDTH, box.w));
  const h = Math.min(size.height, Math.max(MIN_ELEMENT_HEIGHT, box.h));
  const x = Math.min(Math.max(0, box.x), Math.max(0, size.width - w));
  const y = Math.min(Math.max(0, box.y), Math.max(0, size.height - h));
  return { ...box, w, h, x, y };
}
