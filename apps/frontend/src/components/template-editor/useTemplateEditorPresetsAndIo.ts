/**
 * @file useTemplateEditorPresetsAndIo.ts
 * @description Sub-hook providing JSON template import/export and preset application.
 */

import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { DocumentTemplate, DocumentTemplatePreset, TemplateElement } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { downloadTemplateJson, newId, readTemplateJsonFile } from "./templateEditorUtils";
import { notify } from "@/lib/notify";

export interface UseTemplateEditorPresetsAndIoOptions<TPayload = Record<string, unknown>> {
  template: DocumentTemplate<TPayload>;
  setTemplate: Dispatch<SetStateAction<DocumentTemplate<TPayload>>>;
  pushHistory: (currentTemplate: DocumentTemplate<TPayload>) => void;
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  setActivePresetKey: Dispatch<SetStateAction<string | null>>;
  presets?: DocumentTemplatePreset<TPayload>[];
  documentType?: string;
  t: TranslationFunction;
}

export function useTemplateEditorPresetsAndIo<TPayload = Record<string, unknown>>({
  template,
  setTemplate,
  pushHistory,
  setSelectedIds,
  setActivePresetKey,
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
          pushHistory(template);
          const sanitizedElements: TemplateElement<keyof TPayload & string>[] = (
            parsed.elements || []
          ).map((el) => ({
            ...el,
            id: typeof el.id === "string" && el.id.trim().length > 0 ? el.id : newId(),
            type: typeof el.type === "string" ? el.type : "text",
            label: typeof el.label === "string" ? el.label : "",
            x: Number.isFinite(el.x) ? Math.max(0, Math.round(el.x)) : 0,
            y: Number.isFinite(el.y) ? Math.max(0, Math.round(el.y)) : 0,
            w: Number.isFinite(el.w) && el.w > 0 ? Math.round(el.w) : 100,
            h: Number.isFinite(el.h) && el.h > 0 ? Math.round(el.h) : 40,
            style: el.style ? { ...el.style } : undefined,
            columns: Array.isArray(el.columns) ? el.columns.map((col) => ({ ...col })) : undefined,
            tableConfig: el.tableConfig ? { ...el.tableConfig } : undefined,
          }));
          setTemplate((curr) => ({
            ...curr,
            elements: sanitizedElements,
            pageSize: parsed.pageSize || curr.pageSize,
            orientation: parsed.orientation || curr.orientation,
          }));
          setSelectedIds([]);
          notify.success(t("templateEditor.importSuccess"));
        },
        (err) => {
          console.error(err);
          notify.error(t("templateEditor.importFailed"));
        },
      );
    },
    [pushHistory, setTemplate, setSelectedIds, t, template],
  );

  const applyPreset = useCallback(
    (presetKey: string) => {
      const match = presets.find((p) => p.key === presetKey);
      if (!match) return;
      pushHistory(template);
      const clonedElements: TemplateElement<keyof TPayload & string>[] =
        match.template.elements.map((el) => ({
          ...el,
          id: newId(),
          style: el.style ? { ...el.style } : undefined,
          columns: el.columns ? el.columns.map((col) => ({ ...col })) : undefined,
          tableConfig: el.tableConfig ? { ...el.tableConfig } : undefined,
        }));
      setTemplate({
        ...match.template,
        elements: clonedElements,
      });
      setSelectedIds([]);
      setActivePresetKey(presetKey);
    },
    [presets, pushHistory, setActivePresetKey, setSelectedIds, setTemplate, template],
  );

  return {
    exportTemplateJson,
    importTemplateJson,
    applyPreset,
  };
}
