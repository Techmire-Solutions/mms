/**
 * @file useTemplateEditorShortcuts.ts
 * @description Hook managing keyboard shortcut bindings for undo/redo, delete, duplicate, nudge, and selection.
 * Uses React 19 useEffectEvent for a single stable window listener that always reads current values.
 */

import { useEffect, useEffectEvent } from "react";
import {
  isInputElementFocused,
  handleResizeShortcut,
  handleNudgeShortcut,
} from "./templateEditorShortcutUtils";

export interface UseTemplateEditorShortcutsOptions {
  undo: () => void;
  redo: () => void;
  selectAll: () => void;
  deselectAll: () => void;
  duplicateSelected: () => void;
  deleteSelected: () => void;
  nudgeSelected: (dx: number, dy: number) => void;
  hasSelection: boolean;
  onSave?: () => void;
  copySelected?: () => void;
  paste?: () => void;
  resizeSelected?: (dw: number, dh: number) => void;
  zoomIn?: () => void;
  zoomOut?: () => void;
  zoomReset?: () => void;
}

export function useTemplateEditorShortcuts({
  undo,
  redo,
  selectAll,
  deselectAll,
  duplicateSelected,
  deleteSelected,
  nudgeSelected,
  hasSelection,
  onSave,
  copySelected,
  paste,
  resizeSelected,
  zoomIn,
  zoomOut,
  zoomReset,
}: UseTemplateEditorShortcutsOptions): void {
  const handleKeyDown = useEffectEvent((e: KeyboardEvent) => {
    // Intercept global Cmd/Ctrl+S before anything else
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      onSave?.();
      return;
    }

    // Intercept Zoom shortcuts before form input returns
    if ((e.metaKey || e.ctrlKey) && (e.key === "=" || e.key === "+")) {
      e.preventDefault();
      zoomIn?.();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && (e.key === "-" || e.key === "_")) {
      e.preventDefault();
      zoomOut?.();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "0") {
      e.preventDefault();
      zoomReset?.();
      return;
    }

    const target = e.target as HTMLElement | null;
    if (isInputElementFocused(target)) {
      if (e.key === "Escape") {
        target?.blur();
      }
      return;
    }

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c") {
      if (hasSelection) copySelected?.();
      return;
    }

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "x") {
      if (hasSelection) {
        e.preventDefault();
        copySelected?.();
        deleteSelected();
      }
      return;
    }

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "v") {
      paste?.();
      return;
    }

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) {
        redo();
      } else {
        undo();
      }
      return;
    }

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
      e.preventDefault();
      redo();
      return;
    }

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
      e.preventDefault();
      selectAll();
      return;
    }

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
      e.preventDefault();
      duplicateSelected();
      return;
    }

    if (e.key === "Escape") {
      if (hasSelection) {
        e.preventDefault();
        deselectAll();
      }
      return;
    }

    if (e.key === "Delete" || e.key === "Backspace") {
      if (hasSelection) {
        e.preventDefault();
        deleteSelected();
      }
      return;
    }

    if (!hasSelection) return;

    if (resizeSelected && handleResizeShortcut(e, resizeSelected)) {
      return;
    }

    handleNudgeShortcut(e, nudgeSelected);
  });

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
