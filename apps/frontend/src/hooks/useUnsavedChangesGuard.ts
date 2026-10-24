import { useEffect } from "react";

export interface UseUnsavedChangesGuardOptions {
  /**
   * When true the guard is active: browser unload / tab close is intercepted
   * with a confirmation prompt.
   */
  isDirty: boolean;
  /**
   * Prompt shown to the user when they try to navigate away with unsaved changes.
   * Defaults to a generic message.
   */
  message?: string;
}

/**
 * Unsaved-changes navigation guard for Setup-tier and Settings panels (P2-5).
 * Intercepts tab close, page refresh, and external navigation via beforeunload.
 *
 * Usage:
 * ```ts
 * useUnsavedChangesGuard({ isDirty, message: t("settings.unsavedWarning") });
 * ```
 */
export function useUnsavedChangesGuard({
  isDirty,
  message = "You have unsaved changes. Are you sure you want to leave?",
}: UseUnsavedChangesGuardOptions) {
  useEffect(() => {
    if (!isDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Modern browsers display their own generic dialog, but setting returnValue is required.
      event.returnValue = message;
      return message;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty, message]);

  return { isDirty };
}
