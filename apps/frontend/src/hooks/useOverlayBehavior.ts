import { useEffect, useState, type RefObject } from "react";
import { useBodyScrollLock } from "./useBodyScrollLock";
import { useFocusTrap } from "./useFocusTrap";
import { isAnotherLayerFocused, isTopmostOverlayLayer, useOverlayLayer } from "@/lib/overlayStack";

export interface UseOverlayBehaviorOptions {
  /** Whether the overlay is visible/active. */
  open?: boolean;
  /** Callback fired when the user presses the Escape key. */
  onClose?: () => void;
  /** Whether to lock body scrolling when open. Defaults to true. */
  lockScroll?: boolean;
  /**
   * Whether Escape may dismiss the overlay. Defaults to true.
   *
   * Set false for overlays the user must resolve (e.g. the session-timeout
   * warning) — focus trapping and scroll locking still apply.
   */
  dismissible?: boolean;
}

/**
 * Encapsulates standard overlay behaviors:
 * - Trapping keyboard focus within container
 * - Locking background body scrolling
 * - Dismissing overlay on Escape key press
 *
 * Escape is only honoured for the *topmost* overlay. Before this, every mounted
 * overlay listened on `window` and closed unconditionally, so dismissing a
 * confirm dialog nested in a detail drawer closed the drawer as well.
 *
 * @param options Configuration for overlay behavior.
 * @returns Ref object to attach to container element for focus trapping.
 */
export function useOverlayBehavior<T extends HTMLElement = HTMLElement>({
  open = true,
  onClose,
  lockScroll = true,
  dismissible = true,
}: UseOverlayBehaviorOptions): RefObject<T | null> {
  useBodyScrollLock(open && lockScroll);
  const containerRef = useFocusTrap<T>(open);
  // Stable layer identity: lazy-initialised state (never a render-time ref
  // read) so the layer stack key survives every re-render of the overlay.
  const [layerId] = useState(() => Symbol("overlay-layer"));

  // A non-dismissible overlay still participates in the layer stack: it blocks
  // Escape from reaching the overlays underneath it.
  useOverlayLayer(layerId, open && dismissible);

  useEffect(() => {
    if (!open || !onClose || !dismissible) return;

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      // A nested overlay opened later owns the key.
      if (!isTopmostOverlayLayer(layerId)) return;
      // Radix layers (AlertDialog, menus, popovers) portal to <body> and move
      // focus out of this container; an Escape aimed at one of those must not
      // reach us even though they are not in the registry.
      if (isAnotherLayerFocused(containerRef.current)) return;
      onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, containerRef, dismissible, layerId]);

  return containerRef;
}
