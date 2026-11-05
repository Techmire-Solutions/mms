import { useEffect } from "react";
import { isOverlayOpen, isTypingTarget } from "@/lib/ui/keyboardGuards";

interface UseMessagingKeyboardShortcutsOptions {
  canWrite: boolean;
  hasActiveComposer: boolean;
  startCampaign: (channel: "whatsapp" | "sms" | "email") => void;
}

/**
 * Handles direct channel keyboard shortcuts (W = WhatsApp, S = SMS, E = Email).
 */
export function useMessagingKeyboardShortcuts({
  canWrite,
  hasActiveComposer,
  startCampaign,
}: UseMessagingKeyboardShortcutsOptions): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      // Never fire while typing or while a modal/drawer owns the keyboard —
      // `w`/`s`/`e` are bare letters and are otherwise triggered from dialogs.
      if (isTypingTarget(e.target) || isOverlayOpen()) return;

      if (!canWrite || hasActiveComposer) return;

      if ((e.key === "w" || e.key === "W") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        void startCampaign("whatsapp");
      } else if ((e.key === "s" || e.key === "S") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        void startCampaign("sms");
      } else if ((e.key === "e" || e.key === "E") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        void startCampaign("email");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canWrite, hasActiveComposer, startCampaign]);
}
