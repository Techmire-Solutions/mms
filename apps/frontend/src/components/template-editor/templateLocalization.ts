/**
 * @file templateLocalization.ts
 * @description Localized field and preset labels for document-template editors.
 *
 * The key builder is passed in by each adapter as an inline template literal, so the
 * unused-translation ratchet can see the static key prefix and the module owns the
 * naming. A guard test pins that every derived key exists in the English pack.
 */

import type { DocumentTemplatePreset, TemplateFieldDefinition } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

/** `t()` requires a literal key; adapters supply the prefix as a template literal. */
type TranslationKey = Parameters<TranslationFunction>[0];

export function localizeTemplateFields<TPayload>(
  fields: readonly TemplateFieldDefinition<TPayload>[],
  keyFor: (field: TemplateFieldDefinition<TPayload>) => string,
  t: TranslationFunction,
): TemplateFieldDefinition<TPayload>[] {
  return fields.map((field) => ({
    ...field,
    label: t(keyFor(field) as TranslationKey),
  }));
}

export function localizeTemplatePresets<TPayload>(
  presets: readonly DocumentTemplatePreset<TPayload>[],
  keyFor: (preset: DocumentTemplatePreset<TPayload>) => string,
  t: TranslationFunction,
): DocumentTemplatePreset<TPayload>[] {
  return presets.map((preset) => ({
    ...preset,
    label: t(keyFor(preset) as TranslationKey),
  }));
}
