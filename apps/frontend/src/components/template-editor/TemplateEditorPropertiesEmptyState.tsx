import React from "react";
import { Layers } from "lucide-react";
import type { TemplateElement } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { TemplateEditorLayerList } from "./TemplateEditorLayerList";

export interface TemplateEditorPropertiesEmptyStateProps<TPayload = Record<string, unknown>> {
  elements?: TemplateElement<keyof TPayload & string>[];
  onSelectElement?: (elementId: string) => void;
  t: TranslationFunction;
}

export function TemplateEditorPropertiesEmptyState<TPayload = Record<string, unknown>>({
  elements = [],
  onSelectElement,
  t,
}: TemplateEditorPropertiesEmptyStateProps<TPayload>): React.JSX.Element {
  return (
    <aside
      aria-label={t("templateEditor.properties")}
      className="max-h-64 w-full shrink-0 space-y-4 overflow-y-auto border-t border-border bg-card p-3 lg:max-h-none lg:w-60 lg:border-t-0 lg:border-s select-none print:hidden"
    >
      <div className="flex flex-col items-center justify-center p-2 text-center">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-3 text-primary shadow-xs">
          <Layers className="w-6 h-6" aria-hidden="true" />
        </div>
        <p className="text-xs font-semibold text-foreground m-0">{t("templateEditor.emptyHint")}</p>
        <p className="text-3xs text-muted-foreground mt-1.5 max-w-48 leading-relaxed m-0">
          {t("templateEditor.emptyHintDetail")}
        </p>
      </div>

      <section className="space-y-2 pt-2 border-t border-border">
        <h3 className="m-0 text-xs font-bold uppercase text-muted-foreground tracking-widest">
          {t("templateEditor.layerList")}
        </h3>
        <TemplateEditorLayerList
          elements={elements}
          selectedIds={[]}
          onSelectElement={onSelectElement || (() => {})}
          t={t}
        />
      </section>
    </aside>
  );
}
