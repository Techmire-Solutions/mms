/**
 * @file useTemplateEditorModal.ts
 * @description Manages fullscreen modal dialog state and the beforeunload safeguard.
 * Focus trapping, focus restore, body scroll locking and Escape handling are delegated
 * to the shared overlay primitive (`useOverlayBehavior`).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useOverlayBehavior } from "@/hooks/useOverlayBehavior";

export interface UseTemplateEditorModalOptions {
  initialFullscreen?: boolean;
  isDirty?: boolean;
  onClose: () => void;
  confirmDiscardPrompt?: () => boolean;
  /**
   * Lets the editor reserve Escape for a nearer concern. The shortcut layer uses
   * Escape to clear the canvas selection, and both layers listen on `window`, so
   * without this guard one Escape press cleared the selection *and* closed the editor.
   * The Close button deliberately ignores this.
   */
  ignoreEscapeWhen?: () => boolean;
}

export interface UseTemplateEditorModalReturn {
  isFullscreen: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  handleClose: () => void;
  handleToggleFullscreen: () => void;
}

export function useTemplateEditorModal({
  initialFullscreen = true,
  isDirty = false,
  onClose,
  confirmDiscardPrompt,
  ignoreEscapeWhen,
}: UseTemplateEditorModalOptions): UseTemplateEditorModalReturn {
  const [isFullscreen, setIsFullscreen] = useState(initialFullscreen);
  const [isUserToggled, setIsUserToggled] = useState(false);

  // Sync state if parent toggles initialFullscreen prop and user hasn't explicitly toggled it locally
  useEffect(() => {
    if (!isUserToggled) {
      setIsFullscreen(initialFullscreen);
    }
  }, [initialFullscreen, isUserToggled]);

  // Keep volatile options in a ref so handleClose stays 100% stable. Updated in
  // an effect (not during render) to stay correct under concurrent rendering.
  const optionsRef = useRef({
    isDirty,
    confirmDiscardPrompt,
    onClose,
    isFullscreen,
    isUserToggled,
  });
  useEffect(() => {
    optionsRef.current = { isDirty, confirmDiscardPrompt, onClose, isFullscreen, isUserToggled };
  });

  const handleClose = useCallback(() => {
    const opts = optionsRef.current;
    if (opts.isDirty) {
      const confirmed = opts.confirmDiscardPrompt ? opts.confirmDiscardPrompt() : true;
      if (!confirmed) return;
    }
    if (opts.isFullscreen && opts.isUserToggled) {
      setIsFullscreen(false);
      setIsUserToggled(false);
    } else {
      opts.onClose();
    }
  }, []);

  /*
   * The shared overlay primitive owns everything the hand-rolled version got wrong:
   * it captures the opener once when the overlay becomes active and restores focus on
   * cleanup (the old effect re-captured `document.activeElement` on every fullscreen
   * change, so leaving fullscreen dropped focus onto the page behind the still-open
   * editor and then remembered *that* as the opener), it traps Tab, it locks body
   * scroll, and it only honours Escape for the topmost overlay — so dismissing a
   * nested confirm dialog no longer closes the editor underneath it.
   */
  const ignoreEscapeRef = useRef(ignoreEscapeWhen);
  useEffect(() => {
    ignoreEscapeRef.current = ignoreEscapeWhen;
  });

  const handleEscapeClose = useCallback(() => {
    if (ignoreEscapeRef.current?.()) return;
    handleClose();
  }, [handleClose]);

  const containerRef = useOverlayBehavior<HTMLDivElement>({
    open: isFullscreen,
    onClose: handleEscapeClose,
    dismissible: true,
  });

  // Protect against accidental browser tab closure/reload when changes are unsaved
  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
    setIsUserToggled(true);
  }, []);

  return {
    isFullscreen,
    containerRef,
    handleClose,
    handleToggleFullscreen,
  };
}
