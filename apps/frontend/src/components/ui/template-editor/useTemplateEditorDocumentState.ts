/**
 * @file useTemplateEditorDocumentState.ts
 * @description Sub-hook managing template document state, undo/redo history, dirty tracking, and save operations.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getPageDimensions,
  type DocumentTemplate,
  type TemplateElement,
  type TemplateOrientation,
} from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { cloneTemplateElements } from "./templateEditorCloning";
import { notify } from "@/lib/notify";

/** Repeated edits closer together than this collapse into a single undo step. */
const COALESCE_WINDOW_MS = 700;

export interface UseTemplateEditorDocumentStateOptions<TPayload = Record<string, unknown>> {
  initialTemplate?: DocumentTemplate<TPayload>;
  defaultTemplate: DocumentTemplate<TPayload>;
  onSave?: (template: DocumentTemplate<TPayload>) => void | Promise<void>;
  t: TranslationFunction;
}

export function useTemplateEditorDocumentState<TPayload = Record<string, unknown>>({
  initialTemplate,
  defaultTemplate,
  onSave,
  t,
}: UseTemplateEditorDocumentStateOptions<TPayload>) {
  const [template, setTemplate] = useState<DocumentTemplate<TPayload>>(
    () => initialTemplate || defaultTemplate,
  );
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<DocumentTemplate<TPayload>[]>([]);
  const [future, setFuture] = useState<DocumentTemplate<TPayload>[]>([]);
  const [activePresetKey, setActivePresetKey] = useState<string | null>(null);

  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCoalesceRef = useRef<{ key: string; at: number } | null>(null);
  const lastSavedTemplateJsonRef = useRef<string>(
    JSON.stringify(initialTemplate || defaultTemplate),
  );
  const hasHydratedRef = useRef(false);

  useEffect(() => {
    if (initialTemplate) {
      const isFirstHydration = !hasHydratedRef.current;
      const initialJson = JSON.stringify(initialTemplate);
      if (
        isFirstHydration ||
        (initialJson !== lastSavedTemplateJsonRef.current &&
          JSON.stringify(template) === lastSavedTemplateJsonRef.current)
      ) {
        setTemplate(initialTemplate);
        lastSavedTemplateJsonRef.current = initialJson;
        hasHydratedRef.current = true;
      }
    }
  }, [initialTemplate, template]);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const orientation = template.orientation || "portrait";
  const size = useMemo(
    () => getPageDimensions(template.pageSize, orientation),
    [template.pageSize, orientation],
  );

  const pushHistory = useCallback((currentTemplate: DocumentTemplate<TPayload>) => {
    setHistory((historyStack) => [...historyStack.slice(-30), currentTemplate]);
    setFuture([]);
  }, []);

  const undo = useCallback(() => {
    setHistory((historyStack) => {
      if (!historyStack.length) return historyStack;
      const prev = historyStack[historyStack.length - 1]!;
      setFuture((futureStack) => [template, ...futureStack]);
      setTemplate(prev);
      return historyStack.slice(0, -1);
    });
  }, [template]);

  const redo = useCallback(() => {
    setFuture((futureStack) => {
      if (!futureStack.length) return futureStack;
      const nextTemplate = futureStack[0]!;
      setHistory((historyStack) => [...historyStack, template]);
      setTemplate(nextTemplate);
      return futureStack.slice(1);
    });
  }, [template]);

  type ElementUpdater = (
    elements: TemplateElement<keyof TPayload & string>[],
  ) => TemplateElement<keyof TPayload & string>[];

  const updateElements = useCallback((updateFn: ElementUpdater) => {
    setTemplate((curr) => ({ ...curr, elements: updateFn(curr.elements) }));
  }, []);

  const commitUpdate = useCallback((updateFn: ElementUpdater) => {
    setTemplate((curr) => {
      const nextTemplate = { ...curr, elements: updateFn(curr.elements) };
      setHistory((historyStack) => [...historyStack.slice(-30), curr]);
      setFuture([]);
      return nextTemplate;
    });
    setActivePresetKey(null);
  }, []);

  const commitUpdateCoalesced = useCallback((coalesceKey: string, updateFn: ElementUpdater) => {
    setTemplate((curr) => {
      const nextTemplate = { ...curr, elements: updateFn(curr.elements) };
      const now = Date.now();
      const last = lastCoalesceRef.current;
      const startsNewStep = !last || last.key !== coalesceKey || now - last.at > COALESCE_WINDOW_MS;
      if (startsNewStep) {
        setHistory((historyStack) => [...historyStack.slice(-30), curr]);
        setFuture([]);
      }
      lastCoalesceRef.current = { key: coalesceKey, at: now };
      return nextTemplate;
    });
  }, []);

  const handlePageSize = useCallback(
    (pageSizeKey: string) => {
      pushHistory(template);
      setTemplate((curr) => ({ ...curr, pageSize: pageSizeKey }));
    },
    [pushHistory, template],
  );

  const handleOrientationChange = useCallback(
    (nextOrientation: TemplateOrientation) => {
      pushHistory(template);
      setTemplate((curr) => ({ ...curr, orientation: nextOrientation }));
    },
    [pushHistory, template],
  );

  const handleSave = useCallback(async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(template);
      setSaved(true);
      lastSavedTemplateJsonRef.current = JSON.stringify(template);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Template save error:", err);
      notify.error(t("templateEditor.exportFailed"));
    } finally {
      setSaving(false);
    }
  }, [onSave, t, template]);

  const resetToDefault = useCallback(() => {
    pushHistory(template);
    setTemplate({
      ...defaultTemplate,
      elements: cloneTemplateElements(defaultTemplate.elements),
    });
  }, [defaultTemplate, pushHistory, template]);

  const isDirty = useMemo(
    () => JSON.stringify(template) !== lastSavedTemplateJsonRef.current,
    [template],
  );

  return {
    template,
    setTemplate,
    saved,
    saving,
    isDirty,
    history,
    future,
    setHistory,
    setFuture,
    orientation,
    size,
    pushHistory,
    undo,
    redo,
    updateElements,
    commitUpdate,
    commitUpdateCoalesced,
    handlePageSize,
    handleOrientationChange,
    handleSave,
    resetToDefault,
    activePresetKey,
    setActivePresetKey,
  };
}
