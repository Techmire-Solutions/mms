import { useEffect } from "react";

/**
 * Overlay layer registry — decides which overlay owns an Escape key.
 *
 * Every dismissible overlay used to attach its own `window` keydown listener and
 * close on Escape unconditionally. With two overlays mounted at once that closed
 * BOTH: `ContactDetail` renders a `ConfirmAlertDialog` inside a
 * `Drawer`, so pressing Escape to dismiss the confirm dialog also
 * dismissed the drawer behind it and dropped the user out of the record.
 *
 * Overlays now register when they open and only the topmost one reacts to
 * Escape. Registration is a plain module-level stack (not React state) because it
 * must be readable synchronously from a DOM event handler and must not trigger
 * re-renders.
 *
 * Radix-based overlays (AlertDialog and friends) portal outside the tree that
 * renders them and keep their own Escape handling, so they are not registered
 * here. They are covered by the focus-ownership guard in `useOverlayBehavior`
 * instead — see `isAnotherLayerFocused`.
 */

const layers: symbol[] = [];

/** Marks `layer` as no longer dismissible. Safe to call more than once. */
function removeLayer(layer: symbol): void {
  // `lastIndexOf` + splice (not filter) keeps this correct if the same layer
  // was somehow pushed twice, and avoids rebuilding the array on every close.
  const index = layers.lastIndexOf(layer);
  if (index !== -1) {
    layers.splice(index, 1);
  }
}

/**
 * Registers an overlay layer on mount and removes it on unmount/close.
 *
 * @param id Stable per-overlay identity, usually from `useRef(Symbol())`.
 * @param active Whether this layer is currently open and dismissible.
 */
export function useOverlayLayer(id: symbol, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    layers.push(id);
    return () => removeLayer(id);
  }, [id, active]);
}

/** True when `id` is the most recently opened, still-open overlay layer. */
export function isTopmostOverlayLayer(id: symbol): boolean {
  return layers.length > 0 && layers[layers.length - 1] === id;
}

/** Number of registered, open overlay layers. Exposed for tests. */
export function overlayLayerCount(): number {
  return layers.length;
}

/**
 * True when keyboard focus currently sits outside `container` because a
 * different, portalled layer owns it.
 *
 * Radix portals dialog/menu/popover content to `document.body` and moves focus
 * into it, so an Escape aimed at that layer must not also dismiss the overlay
 * underneath. Focus falling back to `<body>` (nothing focused) is treated as
 * "we own it" so Escape still works.
 */
export function isAnotherLayerFocused(container: HTMLElement | null): boolean {
  if (typeof document === "undefined") return false;
  const active = document.activeElement;
  if (!container || !active || active === document.body) return false;
  return !container.contains(active);
}
