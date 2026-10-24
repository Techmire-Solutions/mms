/**
 * @file useTemplateEditor.ts
 * @description Headless hook managing template state, undo/redo stacks, element lifecycle, and shortcut commands.
 */

import { useCallback, useRef, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import {
  type DocumentTemplate,
  type DocumentTemplatePreset,
  type TemplateFieldDefinition,
} from "@mms/shared";
import {
  useTemplateEditorInteractions,
  type DragStateInfo,
  type ResizeStateInfo,
} from "./useTemplateEditorInteractions";
import { useTemplateEditorShortcutsSetup } from "./useTemplateEditorShortcutsSetup";
import { useTemplateEditorElementActions } from "./useTemplateEditorElementActions";
import { useTemplateEditorZoom } from "./useTemplateEditorZoom";
import { useTemplateEditorClipboard } from "./useTemplateEditorClipboard";
import { useTemplateEditorDocumentState } from "./useTemplateEditorDocumentState";
import { useTemplateEditorPresetsAndIo } from "./useTemplateEditorPresetsAndIo";
import { useTemplateEditorNotices } from "./useTemplateEditorNotices";
import { useTemplateEditorElementSelection } from "./useTemplateEditorElementSelection";

export interface UseTemplateEditorOptions<TPayload = Record<string, unknown>> {
  initialTemplate?: DocumentTemplate<TPayload>;
  defaultTemplate?: DocumentTemplate<TPayload>;
  availableFields?: TemplateFieldDefinition<TPayload>[];
  presets?: DocumentTemplatePreset<TPayload>[];
  onSave?: (template: DocumentTemplate<TPayload>) => void | Promise<void>;
  onClose?: () => void;
  documentType?: string;
}

const FALLBACK_TEMPLATE: DocumentTemplate = {
  pageSize: "A5",
  orientation: "portrait",
  elements: [],
};

export function useTemplateEditor<TPayload = Record<string, unknown>>({
  initialTemplate,
  defaultTemplate = FALLBACK_TEMPLATE as DocumentTemplate<TPayload>,
  availableFields = [],
  presets = [],
  onSave,
  documentType,
}: UseTemplateEditorOptions<TPayload> = {}) {
  const { t, isRtl } = useTranslation();

  const doc = useTemplateEditorDocumentState<TPayload>({
    initialTemplate,
    defaultTemplate,
    onSave,
    t,
  });

  const [showGuides, setShowGuides] = useState(true);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const { flashElementId, deletionNotice, handleElementAdded, handleElementDeleted } =
    useTemplateEditorNotices({ t });

  const canvasRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<DragStateInfo<TPayload> | null>(null);
  const resizeState = useRef<ResizeStateInfo<TPayload> | null>(null);

  const zoom = useTemplateEditorZoom({ size: doc.size });

  const {
    selectedIds,
    setSelectedIds,
    selectedId,
    setSelectedId,
    selectedSet,
    selectedElements,
    selectedElement,
    deselectAll,
    selectAll,
    onMouseDownElement,
    onMouseDownResize,
  } = useTemplateEditorElementSelection<TPayload>({
    elements: doc.template.elements,
    canvasRef,
    dragState,
    resizeState,
    template: doc.template,
  });

  const interactions = useTemplateEditorInteractions({
    canvasScale: zoom.canvasScale,
    size: doc.size,
    templateElements: doc.template.elements,
    dragState,
    resizeState,
    canvasViewportRef: zoom.canvasViewportRef,
    updateElements: doc.updateElements,
    setHistory: doc.setHistory,
    setFuture: doc.setFuture,
  });

  const elementActions = useTemplateEditorElementActions<TPayload>({
    elements: doc.template.elements,
    selectedIds,
    setSelectedIds,
    commitUpdate: doc.commitUpdate,
    commitUpdateCoalesced: doc.commitUpdateCoalesced,
    size: doc.size,
    onElementAdded: handleElementAdded,
    onElementDeleted: handleElementDeleted,
    t,
  });

  const clipboard = useTemplateEditorClipboard<TPayload>({
    elements: doc.template.elements,
    selectedSet,
    selectedIds,
    setSelectedIds,
    commitUpdate: doc.commitUpdate,
    size: doc.size,
  });

  useTemplateEditorShortcutsSetup({
    doc,
    selectAll,
    deselectAll,
    elementActions,
    clipboard,
    zoom,
    selectedIds,
  });

  const { exportTemplateJson, importTemplateJson, applyPreset } =
    useTemplateEditorPresetsAndIo<TPayload>({
      template: doc.template,
      setTemplate: doc.setTemplate,
      pushHistory: doc.pushHistory,
      setSelectedIds,
      setActivePresetKey: doc.setActivePresetKey,
      presets,
      documentType,
      t,
    });

  const resetToDefault = useCallback(() => {
    doc.resetToDefault();
    setSelectedIds([]);
  }, [doc, setSelectedIds]);

  return {
    t,
    isRtl,
    template: doc.template,
    selectedId,
    selectedIds,
    setSelectedId,
    setSelectedIds,
    selectAll,
    deselectAll,
    selectedElement,
    selectedElements,
    showGuides,
    setShowGuides,
    isPreviewMode,
    setIsPreviewMode,
    saved: doc.saved,
    saving: doc.saving,
    isDirty: doc.isDirty,
    flashElementId,
    deletionNotice,
    history: doc.history,
    future: doc.future,
    ...zoom,
    ...interactions,
    canvasRef,
    size: doc.size,
    orientation: doc.orientation,
    undo: doc.undo,
    redo: doc.redo,
    exportTemplateJson,
    importTemplateJson,
    applyPreset,
    activePresetKey: doc.activePresetKey,
    copySelected: clipboard.copySelected,
    paste: clipboard.paste,
    onMouseDownElement,
    onMouseDownResize,
    handleSave: doc.handleSave,
    handlePageSize: doc.handlePageSize,
    handleOrientationChange: doc.handleOrientationChange,
    resetToDefault,
    availableFields,
    presets,
    ...elementActions,
  };
}
