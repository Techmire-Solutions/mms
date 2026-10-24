/**
 * @file TemplateEditorSection.tsx
 * @description Shared collapsible inspector section used by every properties-panel block.
 */

import React, { useEffect, useId, useRef } from "react";
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
 * The panel stays mounted and uses `hidden="until-found"` (Modern Web Guidance:
 * search-hidden-content) so native in-page searches (Cmd+F / Ctrl+F) reveal hidden
 * text and trigger `beforematch` to synchronize open state and `aria-expanded`.
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
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;

    if (!isOpen) {
      el.setAttribute("hidden", "until-found");
    } else {
      el.removeAttribute("hidden");
    }

    const handleBeforeMatch = () => {
      if (!isOpen) {
        onToggle();
      }
    };

    el.addEventListener("beforematch", handleBeforeMatch);
    return () => {
      el.removeEventListener("beforematch", handleBeforeMatch);
    };
  }, [isOpen, onToggle]);

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
       * Modern Web Guidance: search-hidden-content
       * When collapsed, `hidden="until-found"` allows browser find-in-page to search
       * nested text. `beforematch` invokes `onToggle()` to synchronize visual and ARIA states.
       */}
      <div
        ref={panelRef}
        id={panelId}
        role="group"
        aria-labelledby={headingId}
        aria-hidden={!isOpen}
        className={`transition-[grid-template-rows] duration-200 ease-in-out ${
          isOpen ? "grid grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className={`min-h-0 overflow-hidden mt-1 ${isOpen ? panelClassName : ""}`}>
          {children}
        </div>
      </div>
    </section>
  );
}
