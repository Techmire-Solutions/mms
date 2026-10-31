import { useCallback } from "react";
import type { HTMLMotionProps } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export interface UseListRowMotionOptions {
  /** Reorder/position layout animation (e.g. `true` or `"position"`). */
  layout?: HTMLMotionProps<"tr">["layout"];
  /** Enable the opacity enter fade. */
  fade?: boolean;
  /** Enter fade duration in seconds when no per-row delay is passed (default 0.1). */
  duration?: number;
}

export type ListRowMotionFn = (delay?: number) => ListRowMotionProps;

export type ListRowMotionProps = Pick<
  HTMLMotionProps<"tr">,
  "layout" | "initial" | "animate" | "transition"
>;

/**
 * Returns a function producing motion props for list/table rows, honoring
 * `prefers-reduced-motion`. Call once at the component top; invoke per row,
 * optionally with a stagger delay (seconds): `<motion.tr {...rowMotion(index * 0.04)} />`.
 * Drops `exit` — no `AnimatePresence` wraps these lists, so exit never fires.
 */
export function useListRowMotion({
  layout = false,
  fade = false,
  duration = 0.1,
}: UseListRowMotionOptions = {}): ListRowMotionFn {
  const reducedMotion = useReducedMotion();
  // Stable identity: rows are React.memo'd and receive this as a prop, so a new
  // closure per render made every table row re-render on unrelated state changes.
  return useCallback(
    (delay = 0): ListRowMotionProps => {
      if (reducedMotion) {
        return { layout: false, initial: false };
      }
      const props: ListRowMotionProps = { layout };
      if (fade) {
        props.initial = { opacity: 0 };
        props.animate = { opacity: 1 };
        props.transition = delay > 0 ? { delay } : { duration };
      }
      return props;
    },
    [reducedMotion, layout, fade, duration],
  );
}
