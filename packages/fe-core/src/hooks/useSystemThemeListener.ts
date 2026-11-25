import { useEffect } from "react";
import { useMediaQuery } from "./useMediaQuery";

/**
 * Subscribes to the OS `prefers-color-scheme` media query and mirrors the
 * current dark preference into React state. The optional `onChange` fires for
 * the initial read and every OS preference change.
 *
 * Shared SSOT for theme previews that need the live system preference
 * (platform theme preview, tenant theme settings draft).
 */
export function useSystemThemeListener(onChange?: (prefersDark: boolean) => void): boolean {
  const systemPrefersDark = useMediaQuery("(prefers-color-scheme: dark)");

  useEffect(() => {
    onChange?.(systemPrefersDark);
  }, [onChange, systemPrefersDark]);

  return systemPrefersDark;
}
