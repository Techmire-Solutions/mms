import { useEffect } from "react";
import { isConfirmDialogOpen, isTypingTarget } from "@/lib/ui/keyboardGuards";

export interface UseCmdEnterShortcutOptions {
  /** Register the listener only while the owning surface is active/open. */
  enabled: boolean;
  onTrigger: () => void;
  /**
   * Allow the shortcut while a text field has focus (form/composer save).
   * Drawers that react to the key must set this to `false`.
   */
  allowTyping?: boolean;
}

/**
 * Cmd/Ctrl+Enter submit shortcut shared by the messaging composer, template
 * form and log drawer.
 *
 * Never fires while a confirmation dialog is open: those two dialogs (composer,
 * template form) sit *inside* a `role="dialog"`, so a general overlay check
 * cannot be used, and the user is answering "discard or keep" at that moment —
 * not asking to send/save.
 */
export function useCmdEnterShortcut({
  enabled,
  onTrigger,
  allowTyping = true,
}: UseCmdEnterShortcutOptions): void {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey) || event.key !== "Enter") return;
      if (event.isComposing) return;
      if (isConfirmDialogOpen()) return;
      if (!allowTyping && isTypingTarget(event.target)) return;
      event.preventDefault();
      onTrigger();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [allowTyping, enabled, onTrigger]);
}
