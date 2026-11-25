import { useEffect, useRef } from "react";
import { scrollPageSurfaceToTop } from "./scrollDocumentToTop";

type UseScrollSurfaceOnChangeOptions = {
  /** Defaults to true. */
  enabled?: boolean;
  behavior?: ScrollBehavior;
  block?: ScrollLogicalPosition;
  /** Mobile accordion/section target resolver (read inside the effect). */
  resolveMobileTarget?: (key: string) => HTMLElement | null | undefined;
};

/** Scroll the active page surface when `activeKey` changes (skips the initial mount). */
export function useScrollSurfaceOnChange(
  activeKey: string,
  options: UseScrollSurfaceOnChangeOptions = {},
): void {
  const enabled = options.enabled ?? true;
  const behavior = options.behavior ?? "smooth";
  const block = options.block ?? "start";
  const resolveMobileTarget = options.resolveMobileTarget;
  // Latest-callback ref, synced in an effect: listing `resolveMobileTarget` in the
  // scroll effect's deps would re-scroll on every render when the caller passes an
  // inline resolver, and writing the ref during render is banned (`react-hooks/refs`).
  const resolveMobileTargetRef = useRef(resolveMobileTarget);
  useEffect(() => {
    resolveMobileTargetRef.current = resolveMobileTarget;
  }, [resolveMobileTarget]);
  const skipInitialRef = useRef(true);

  useEffect(() => {
    if (!enabled || !activeKey) return;
    if (skipInitialRef.current) {
      skipInitialRef.current = false;
      return;
    }

    scrollPageSurfaceToTop({
      behavior,
      block,
      mobileTarget: resolveMobileTargetRef.current?.(activeKey) ?? null,
    });
  }, [activeKey, enabled, behavior, block]);
}
