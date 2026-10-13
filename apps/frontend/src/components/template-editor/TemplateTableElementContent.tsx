import React from "react";
import type { TemplateElement } from "@mms/shared";
import { PRINT_NEUTRAL } from "@/lib/ui/printBrandingTokens";
import {
  TABLE_FALLBACK_ROWS,
  resolveTableRows,
  visibleTableRowCount,
  type TemplateRenderMode,
} from "./templateDataResolution";

export interface TemplateTableElementContentProps {
  el: TemplateElement;
  data?: Record<string, unknown> | null;
  mode: TemplateRenderMode;
  defaultColAlign: "left" | "right" | "center";
  tableFontSize: number;
}

export function TemplateTableElementContent({
  el,
  data,
  mode,
  defaultColAlign,
  tableFontSize,
}: TemplateTableElementContentProps): React.JSX.Element {
  const resolvedRows = resolveTableRows(el, data);
  const rows = (resolvedRows ?? (mode === "print" ? [] : TABLE_FALLBACK_ROWS)).slice(
    0,
    visibleTableRowCount(el),
  );

  return (
    <div className="w-full h-full overflow-hidden flex flex-col select-none text-xs pointer-events-none">
      {el.tableConfig?.showHeader !== false && (
        <div
          style={{
            fontSize: `${tableFontSize}px`,
            backgroundColor: el.tableConfig?.headerBackground || "#f1f5f9",
            borderBottom: `1px solid ${el.tableConfig?.borderColor || PRINT_NEUTRAL.border}`,
          }}
          className="flex items-center font-bold uppercase tracking-wider text-muted-foreground shrink-0 px-1 py-1"
        >
          {(el.columns || []).map((col, idx) => (
            <div
              key={idx}
              style={{
                width: col.width ? `${col.width}px` : undefined,
                flex: col.width ? undefined : 1,
                textAlign: col.align || defaultColAlign,
              }}
              className="truncate px-1"
            >
              {col.header}
            </div>
          ))}
        </div>
      )}
      <div className="flex-1 overflow-hidden divide-y divide-border/40">
        {rows.map((row, rIdx) => (
          <div
            key={rIdx}
            style={{
              fontSize: `${tableFontSize}px`,
              height: el.tableConfig?.rowHeight || 22,
              backgroundColor:
                el.tableConfig?.zebra && rIdx % 2 === 1 ? "rgba(0,0,0,0.03)" : "transparent",
            }}
            className="flex items-center px-1"
          >
            {(el.columns || []).map((col, cIdx) => (
              <div
                key={cIdx}
                style={{
                  width: col.width ? `${col.width}px` : undefined,
                  flex: col.width ? undefined : 1,
                  textAlign: col.align || defaultColAlign,
                }}
                className="truncate px-1"
              >
                {String(row[col.field] ?? row[col.header.toLowerCase()] ?? "-")}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
