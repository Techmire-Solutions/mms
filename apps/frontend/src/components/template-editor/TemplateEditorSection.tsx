/**
 * @file TemplateEditorSection.tsx
 * @description Shared collapsible inspector section used by every properties-panel block.
 */

import React, { useId } from "react";
import { ChevronDown } from "lucide-react";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { AppTranslationKey } from "@mms/shared";

export interface TemplateEditorSectionProps {
  titleKey: AppTranslationKey;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  t: TranslationFunction;
  panelClassName?: string;
}

/**
 * One collapsible section pattern for the whole inspector.
 *
 * Three sections each hand-rolled their own toggle button before this: raw
 * `<button>`s below the 44px touch floor, a hardcoded `aria-controls` id that
 * pointed at an element which did not exist while collapsed (`aria-valid-attr-value`
 * violation, and a collision if two editors were mounted), and `<p>` elements where
 * headings belong. The panel stays mounted and is hidden with `hidden` so the
 * `aria-controls` target always exists.
 */
export function TemplateEditorSection({
  titleKey,
  icon: Icon,
  isOpen,
  onToggle,
  children,
  t,
  panelClassName = "space-y-3",
}: TemplateEditorSectionProps): React.JSX.Element {
  const headingId = useId();
  const panelId = useId();

  return (
    <section className="pt-2 border-t border-border">
      <h3 className="m-0">
        <button
          id={headingId}
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls={panelId}
          className="w-full min-h-11 flex items-center justify-between gap-2 py-1 text-xs font-bold uppercase text-muted-foreground tracking-widest rounded-md hover:text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
        >
          <span className="flex items-center gap-1.5">
            <Icon className="w-4 h-4 text-primary/70" aria-hidden="true" />
            <span>{t(titleKey)}</span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className={`w-4 h-4 transition-transform duration-200 ${
              isOpen ? "" : "-rotate-90 text-muted-foreground/50"
            }`}
          />
        </button>
      </h3>
      {/*
       * CSS grid-rows trick: animates between `grid-rows-[0fr]` (collapsed) and
       * `grid-rows-[1fr]` (expanded) with no JS height measurement.
       * The panel is never `hidden` from the DOM so `aria-controls` always has a valid target.
       */}
      <div
        id={panelId}
        role="group"
        aria-labelledby={headingId}
        aria-hidden={!isOpen}
        className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className={`min-h-0 overflow-hidden mt-1 ${isOpen ? panelClassName : ""}`}>
          {children}
        </div>
      </div>
    </section>
  );
}
