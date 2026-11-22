import { useMediaQuery } from "@/hooks/useMediaQuery";

/** Mirrors `prefers-reduced-motion: reduce` for animation gating. */
export function useReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}
