/**
 * @file TemplateEditorLayerList.tsx
 * @description Z-ordered list of every element on the page, used to select elements
 * that are too small or too covered to click on the canvas.
 */

import React from "react";
import { BoxSelect } from "lucide-react";
import type { TemplateElement } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface TemplateEditorLayerListProps<TPayload = Record<string, unknown>> {
  elements: TemplateElement<keyof TPayload & string>[];
  selectedIds: string[];
  onSelectElement: (elementId: string) => void;
  t: TranslationFunction;
}

/**
 * Why this exists: templates are dense — the shipped presets place 23–29 absolutely
 * positioned elements on one page, many of them 1–2px dividers. Without an outline
 * the only way to select those was to hit a 1px-tall target with the mouse, which is
 * effectively impossible. The list is rendered top-most first (matching what the eye
 * sees) and is the keyboard/touch path to every element on the page.
 */
export function TemplateEditorLayerList<TPayload = Record<string, unknown>>({
  elements,
  selectedIds,
  onSelectElement,
  t,
}: TemplateEditorLayerListProps<TPayload>): React.JSX.Element {
  const topMostFirst = [...elements].reverse();
  const selected = new Set(selectedIds);

  if (topMostFirst.length === 0) {
    return <p className="text-2xs text-muted-foreground m-0">{t("templateEditor.noElements")}</p>;
  }

  return (
    <ul role="list" className="space-y-1 m-0 p-0 list-none max-h-56 overflow-y-auto pe-0.5">
      {topMostFirst.map((el) => {
        const isSelected = selected.has(el.id);
        const name = el.label || t("templateEditor.element");
        return (
          <li key={el.id} role="listitem" className="m-0">
            <button
              type="button"
              onClick={() => onSelectElement(el.id)}
              aria-pressed={isSelected}
              className={`w-full min-h-11 px-2 py-1 rounded-md border text-start transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden ${
                isSelected
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/70 bg-muted/20 text-foreground hover:bg-muted/50"
              }`}
            >
              <span className="flex items-center gap-2">
                <BoxSelect className="w-3.5 h-3.5 shrink-0 opacity-60" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">{name}</span>
                  <span className="block truncate text-3xs text-muted-foreground">
                    {el.type} · {Math.round(el.x)}, {Math.round(el.y)} · {Math.round(el.w)}×
                    {Math.round(el.h)}
                  </span>
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
