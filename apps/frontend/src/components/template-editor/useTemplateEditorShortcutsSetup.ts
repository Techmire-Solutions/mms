import { useTemplateEditorShortcuts } from "./useTemplateEditorShortcuts";

export interface UseTemplateEditorShortcutsSetupOptions {
  doc: {
    undo: () => void;
    redo: () => void;
    handleSave: () => void;
  };
  selectAll: () => void;
  deselectAll: () => void;
  elementActions: {
    duplicateSelected: () => void;
    deleteSelected: () => void;
    nudgeSelected: (dx: number, dy: number) => void;
    resizeSelected: (dw: number, dh: number) => void;
  };
  clipboard: {
    copySelected: () => void;
    paste: () => void;
  };
  zoom: {
    zoomIn: () => void;
    zoomOut: () => void;
    zoomReset: () => void;
  };
  selectedIds: string[];
}

export function useTemplateEditorShortcutsSetup({
  doc,
  selectAll,
  deselectAll,
  elementActions,
  clipboard,
  zoom,
  selectedIds,
}: UseTemplateEditorShortcutsSetupOptions) {
  useTemplateEditorShortcuts({
    undo: doc.undo,
    redo: doc.redo,
    selectAll,
    deselectAll,
    duplicateSelected: elementActions.duplicateSelected,
    deleteSelected: elementActions.deleteSelected,
    nudgeSelected: elementActions.nudgeSelected,
    resizeSelected: elementActions.resizeSelected,
    hasSelection: selectedIds.length > 0,
    onSave: doc.handleSave,
    copySelected: clipboard.copySelected,
    paste: clipboard.paste,
    zoomIn: zoom.zoomIn,
    zoomOut: zoom.zoomOut,
    zoomReset: zoom.zoomReset,
  });
}
