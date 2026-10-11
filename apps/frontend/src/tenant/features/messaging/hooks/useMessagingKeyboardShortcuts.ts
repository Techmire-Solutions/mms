import { useEffect } from "react";

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
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

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
