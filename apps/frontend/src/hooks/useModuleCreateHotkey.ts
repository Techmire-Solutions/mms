import { useEffect } from "react";
import { overlayLayerCount } from "@/lib/overlayStack";

export interface UseModuleCreateHotkeyOptions {
  enabled: boolean;
  onCreate: () => void;
}

/**
 * Registers Cmd/Ctrl+N to open create when enabled (typically `canWrite && !showDeleted`).
 * Ignores the shortcut while typing in inputs/textareas/contenteditable.
 */
export function useModuleCreateHotkey({ enabled, onCreate }: UseModuleCreateHotkeyOptions): void {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Do not open a create form on top of an open dialog/drawer (n3).
      if (overlayLayerCount() > 0) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key?.toLowerCase() === "n") {
        event.preventDefault();
        onCreate();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, onCreate]);
}
