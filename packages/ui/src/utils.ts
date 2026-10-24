import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind classes and handles conditional class expressions safely.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Modern Web Guidance: ime-safe-enter-submit
 * Ensures the Enter keydown event is not consumed while an Input Method Editor (IME)
 * is actively composing characters (e.g. Arabic, Urdu, or CJK text conversion),
 * preventing premature form submission or tag creation.
 */
export function isImeSafeEnter(
  event: { key: string; nativeEvent?: { isComposing?: boolean; keyCode?: number } } | KeyboardEvent,
): boolean {
  if (event.key !== "Enter") return false;
  const native =
    "nativeEvent" in event && event.nativeEvent ? event.nativeEvent : (event as KeyboardEvent);
  if (native.isComposing || native.keyCode === 229) {
    return false;
  }
  return true;
}
