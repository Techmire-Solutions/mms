/**
 * @file TemplateEditorElementIdentitySection.tsx
 * @description Inspector block for the selected element's caption and data binding.
 */

import React from "react";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/ui/FormSelect";
import type { TemplateElement, TemplateFieldDefinition } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface TemplateEditorElementIdentitySectionProps<TPayload = Record<string, unknown>> {
  selectedElement: TemplateElement<keyof TPayload & string>;
  availableFields?: TemplateFieldDefinition<TPayload>[];
  onPatchElement: (
    elementId: string,
    patch: Partial<TemplateElement<keyof TPayload & string>>,
  ) => void;
  t: TranslationFunction;
}

/**
 * The label field means two different things and the UI now says which:
 * for a static element the label *is* the printed text, while for a field element the
 * printed text comes from the bound data field and the label is only the editor caption.
 * The data-field select exists because a field element previously could not be re-bound
 * at all — picking the wrong field from the palette meant deleting and re-adding it.
 */
export function TemplateEditorElementIdentitySection<TPayload = Record<string, unknown>>({
  selectedElement,
  availableFields = [],
  onPatchElement,
  t,
}: TemplateEditorElementIdentitySectionProps<TPayload>): React.JSX.Element {
  const isFieldElement = selectedElement.type === "field";

  return (
    <>
      <div className="space-y-1">
        <label
          htmlFor={`label-input-${selectedElement.id}`}
          className="text-xs font-bold uppercase text-muted-foreground tracking-wide"
        >
          {t("templateEditor.labelText")}
        </label>
        <Input
          id={`label-input-${selectedElement.id}`}
          name={`label-input-${selectedElement.id}`}
          type="text"
          dir="auto"
          value={selectedElement.label}
          onChange={(e) => onPatchElement(selectedElement.id, { label: e.target.value })}
          className="w-full min-h-11 px-2 py-1.5 text-xs border border-border rounded bg-background"
        />
        <p className="text-3xs text-muted-foreground m-0 leading-snug">
          {isFieldElement
            ? t("templateEditor.labelFieldHint")
            : t("templateEditor.labelStaticHint")}
        </p>
      </div>

      {isFieldElement && availableFields.length > 0 && (
        <div className="space-y-1">
          <label
            htmlFor={`field-select-${selectedElement.id}`}
            className="text-xs font-bold uppercase text-muted-foreground tracking-wide"
          >
            {t("templateEditor.dataField")}
          </label>
          <FormSelect
            id={`field-select-${selectedElement.id}`}
            aria-label={t("templateEditor.dataField")}
            value={selectedElement.field ? String(selectedElement.field) : ""}
            onChange={(val) => {
              if (!val) return;
              const match = availableFields.find((f) => String(f.field) === val);
              onPatchElement(selectedElement.id, {
                field: val as keyof TPayload & string,
                ...(match ? { label: match.label } : {}),
              });
            }}
            options={[
              { value: "", label: t("templateEditor.dataField") },
              ...availableFields.map((f) => ({ value: String(f.field), label: f.label })),
            ]}
            className="w-full min-h-11 h-11 text-xs py-0"
          />
        </div>
      )}
    </>
  );
}
