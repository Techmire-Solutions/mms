/**
 * @file useTemplateEditorPresetsAndIo.ts
 * @description Sub-hook providing JSON template import/export and preset application.
 *
 * Both import and preset application replace the whole layout as a single undo step
 * (`replaceTemplate`); they no longer push history by hand, so a coalesced edit can
 * never interleave with a layout swap.
 */

import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { DocumentTemplate, DocumentTemplatePreset, TemplateElement } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { downloadTemplateJson, readTemplateJsonFile } from "./templateJsonIo";
import { newId } from "./templateEditorUtils";
import { notify } from "@/lib/notify";

export interface UseTemplateEditorPresetsAndIoOptions<TPayload = Record<string, unknown>> {
  template: DocumentTemplate<TPayload>;
  replaceTemplate: (template: DocumentTemplate<TPayload>, presetKey?: string | null) => void;
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  presets?: DocumentTemplatePreset<TPayload>[];
  documentType?: string;
  t: TranslationFunction;
}

export function useTemplateEditorPresetsAndIo<TPayload = Record<string, unknown>>({
  template,
  replaceTemplate,
  setSelectedIds,
  presets = [],
  documentType,
  t,
}: UseTemplateEditorPresetsAndIoOptions<TPayload>) {
  const exportTemplateJson = useCallback(
    () => downloadTemplateJson(template, documentType),
    [template, documentType],
  );

  const importTemplateJson = useCallback(
    (file: File) => {
      readTemplateJsonFile<TPayload>(
        file,
        (parsed) => {
          replaceTemplate(parsed);
          setSelectedIds([]);
          notify.success(t("templateEditor.importSuccess"));
        },
        (err) => {
          console.error(err);
          notify.error(
            err.code === "too-large"
              ? t("templateEditor.importFileTooLarge")
              : t("templateEditor.importFailed"),
          );
        },
      );
    },
    [replaceTemplate, setSelectedIds, t],
  );

  const applyPreset = useCallback(
    (presetKey: string) => {
      const match = presets.find((preset) => preset.key === presetKey);
      if (!match) return;
      const clonedElements: TemplateElement<keyof TPayload & string>[] =
        match.template.elements.map((element) => ({
          ...element,
          id: newId(),
          style: element.style ? { ...element.style } : undefined,
          columns: element.columns ? element.columns.map((column) => ({ ...column })) : undefined,
          tableConfig: element.tableConfig ? { ...element.tableConfig } : undefined,
        }));
      replaceTemplate({ ...match.template, elements: clonedElements }, presetKey);
      setSelectedIds([]);
    },
    [presets, replaceTemplate, setSelectedIds],
  );

  return {
    exportTemplateJson,
    importTemplateJson,
    applyPreset,
  };
}
