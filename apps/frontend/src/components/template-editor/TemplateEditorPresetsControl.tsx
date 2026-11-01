import React from "react";
import { LayoutTemplate } from "lucide-react";
import { FormSelect } from "@/components/app/FormSelect";
import type { DocumentTemplatePreset } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface TemplateEditorPresetsControlProps<TPayload = Record<string, unknown>> {
  presets?: DocumentTemplatePreset<TPayload>[];
  activePresetKey?: string | null;
  saving?: boolean;
  onApplyPreset: (presetKey: string) => void;
  t: TranslationFunction;
}

export function TemplateEditorPresetsControl<TPayload = Record<string, unknown>>({
  presets = [],
  activePresetKey = null,
  saving = false,
  onApplyPreset,
  t,
}: TemplateEditorPresetsControlProps<TPayload>): React.JSX.Element | null {
  if (presets.length === 0) return null;

  return (
    <div className="flex items-center gap-1 shrink-0">
      <LayoutTemplate className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
      <FormSelect
        aria-label={t("templateEditor.presets")}
        value={activePresetKey ?? ""}
        disabled={saving}
        onChange={(val) => {
          if (!val) return;
          // Applying a preset is one undoable history step, so it must not ask to
          // "discard unsaved changes".
          onApplyPreset(val);
        }}
        options={[
          { value: "", label: t("templateEditor.presets") },
          ...presets.map((p) => ({ value: p.key, label: p.label })),
        ]}
        className={`h-11 text-xs py-0 min-w-32 ${
          activePresetKey ? "border-primary/50 text-primary" : ""
        }`}
      />
    </div>
  );
}
