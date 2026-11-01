/**
 * @file useTemplateEditorDocumentState.ts
 * @description Template document state: undo/redo history, dirty tracking, save and discard.
 *
 * The state machine is a reducer so every transition is pure. The previous version
 * called `setHistory`/`setFuture`/`setTemplate` from inside other `setState` updaters;
 * StrictMode double-invokes updaters, so a single edit could append the same history
 * entry twice (undo then appeared to do nothing) and redo re-applied a stale frame.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  getPageDimensions,
  type DocumentTemplate,
  type TemplateElement,
  type TemplateOrientation,
} from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { cloneTemplateElements } from "./templateEditorCloning";
import { notify } from "@/lib/notify";

import { documentReducer } from "./templateEditorDocumentReducer";

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
  const initialTemplateRef = useRef(initialTemplate ?? defaultTemplate);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const [state, dispatch] = useReducer(documentReducer<TPayload>, {
    template: initialTemplateRef.current,
    baselineJson: JSON.stringify(initialTemplateRef.current),
    history: [],
    future: [],
    activePresetKey: null,
    lastCoalesce: null,
  });

  // A parent that later supplies the persisted layout (server hydration, side switch)
  // replaces the draft only while it is still pristine.
  const isDirtyNow = JSON.stringify(state.template) !== state.baselineJson;
  const initialJson = initialTemplate ? JSON.stringify(initialTemplate) : null;
  useEffect(() => {
    if (!initialTemplate || initialJson === null) return;
    if (!isDirtyNow && initialJson !== state.baselineJson) {
      dispatch({ type: "hydrate", template: initialTemplate, baselineJson: initialJson });
    }
  }, [initialTemplate, initialJson, isDirtyNow, state.baselineJson]);

  const { template } = state;
  const orientation = template.orientation || "portrait";
  const size = useMemo(
    () => getPageDimensions(template.pageSize, orientation),
    [template.pageSize, orientation],
  );

  const commitUpdate = useCallback(
    (
      updateFn: (
        elements: TemplateElement<keyof TPayload & string>[],
      ) => TemplateElement<keyof TPayload & string>[],
    ) => dispatch({ type: "commit", updateFn }),
    [],
  );

  const commitUpdateCoalesced = useCallback(
    (
      coalesceKey: string,
      updateFn: (
        elements: TemplateElement<keyof TPayload & string>[],
      ) => TemplateElement<keyof TPayload & string>[],
    ) => dispatch({ type: "commit", updateFn, coalesceKey, at: Date.now() }),
    [],
  );

  const updateElements = useCallback(
    (
      updateFn: (
        elements: TemplateElement<keyof TPayload & string>[],
      ) => TemplateElement<keyof TPayload & string>[],
    ) => dispatch({ type: "update", updateFn }),
    [],
  );

  const pushHistorySnapshot = useCallback(
    (snapshot: DocumentTemplate<TPayload>) => dispatch({ type: "push-history", snapshot }),
    [],
  );

  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);

  const handlePageSize = useCallback(
    (pageSizeKey: string) => dispatch({ type: "patch", patch: { pageSize: pageSizeKey } }),
    [],
  );

  const handleOrientationChange = useCallback(
    (nextOrientation: TemplateOrientation) =>
      dispatch({ type: "patch", patch: { orientation: nextOrientation } }),
    [],
  );

  /** Import / preset / reset: one history step, selection cleared by the caller. */
  const replaceTemplate = useCallback(
    (nextTemplate: DocumentTemplate<TPayload>, presetKey: string | null = null) =>
      dispatch({ type: "replace", template: nextTemplate, presetKey }),
    [],
  );

  const setActivePresetKey = useCallback(
    (presetKey: string | null) => dispatch({ type: "set-preset", presetKey }),
    [],
  );

  const discardChanges = useCallback(() => dispatch({ type: "discard" }), []);

  const handleSave = useCallback(async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(template);
      dispatch({ type: "mark-saved" });
      setSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      // One failure toast, owned here; adapters only toast success.
      console.error("Template save error:", err);
      notify.error(t("templateEditor.saveFailed"));
    } finally {
      setSaving(false);
    }
  }, [onSave, t, template]);

  const resetToDefault = useCallback(() => {
    replaceTemplate({
      ...defaultTemplate,
      elements: cloneTemplateElements(defaultTemplate.elements),
    });
  }, [defaultTemplate, replaceTemplate]);

  return {
    template,
    saved,
    saving,
    isDirty: isDirtyNow,
    history: state.history,
    future: state.future,
    activePresetKey: state.activePresetKey,
    orientation,
    size,
    setActivePresetKey,
    pushHistory: pushHistorySnapshot,
    undo,
    redo,
    updateElements,
    commitUpdate,
    commitUpdateCoalesced,
    replaceTemplate,
    discardChanges,
    handlePageSize,
    handleOrientationChange,
    handleSave,
    resetToDefault,
  };
}
