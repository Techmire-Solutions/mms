/**
 * @file measureColumnAutoFitWidth.ts
 * @description Measures the max unwrapped content width of a table column for Excel-like auto-fit on double-click.
 */
import {
  clampModuleColumnWidth,
  MODULE_COLUMN_WIDTH_MIN,
  MODULE_COLUMN_WIDTH_MAX,
} from "@mms/shared";

let measureContainer: HTMLElement | null = null;

function getOrCreateMeasureContainer(): HTMLElement {
  if (measureContainer && document.body.contains(measureContainer)) {
    return measureContainer;
  }
  const container = document.createElement("div");
  container.id = "__mms_column_measure_container";
  container.style.position = "fixed";
  container.style.top = "-9999px";
  container.style.left = "-9999px";
  container.style.visibility = "hidden";
  container.style.pointerEvents = "none";
  container.style.zIndex = "-1";
  container.style.contain = "strict";
  document.body.appendChild(container);
  measureContainer = container;
  return container;
}

function measureElementWidth(el: HTMLElement, container: HTMLElement): number {
  const clone = el.cloneNode(true) as HTMLElement;
  clone.style.display = "inline-block";
  clone.style.width = "max-content";
  clone.style.maxWidth = "none";
  clone.style.minWidth = "0";
  clone.style.whiteSpace = "nowrap";
  clone.style.boxSizing = "border-box";

  // Remove any nested resize separator handles from header measurement
  const separator = clone.querySelector('[role="separator"]');
  if (separator) separator.remove();

  container.appendChild(clone);
  const rect = clone.getBoundingClientRect();
  const width = Math.ceil(rect.width);
  container.removeChild(clone);
  return width;
}

/**
 * Calculates the optimal width for a column by measuring the header and all visible cells,
 * adding comfortable breathing room, and clamping to the configured bounds.
 */
export function measureColumnAutoFitWidth(
  thElement: HTMLElement | null,
  minWidth = MODULE_COLUMN_WIDTH_MIN,
  maxWidth = MODULE_COLUMN_WIDTH_MAX,
): number {
  if (!thElement) return minWidth;
  const table = thElement.closest("table");
  if (!table) return minWidth;

  const headerRow = thElement.parentElement;
  if (!headerRow) return minWidth;

  const thElements = Array.from(headerRow.children) as HTMLElement[];
  const colIndex = thElements.indexOf(thElement);
  if (colIndex === -1) return minWidth;

  const container = getOrCreateMeasureContainer();

  // Measure header (add 28px buffer for sort chevron / padding)
  const headerWidth = measureElementWidth(thElement, container) + 28;
  let maxContentWidth = headerWidth;

  // Measure visible row cells in tbody (sample up to 100 rows for performance)
  const rows = table.querySelectorAll("tbody tr");
  const rowLimit = Math.min(rows.length, 100);

  for (let i = 0; i < rowLimit; i++) {
    const row = rows[i] as HTMLElement;
    const cell = row.children[colIndex] as HTMLElement | undefined;
    if (!cell || cell.tagName.toLowerCase() !== "td") continue;
    // Skip full-width virtualization spacers or colSpan rows
    if ((cell as HTMLTableCellElement).colSpan > 1) continue;

    const cellWidth = measureElementWidth(cell, container);
    if (cellWidth > maxContentWidth) {
      maxContentWidth = cellWidth;
    }
  }

  // Add 16px safety buffer for border/padding breathing room
  const optimalWidth = maxContentWidth + 16;
  return clampModuleColumnWidth(Math.min(maxWidth, Math.max(minWidth, optimalWidth)));
}
