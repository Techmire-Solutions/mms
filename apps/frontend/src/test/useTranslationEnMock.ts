import { translateAppParams } from "@mms/shared";

/**
 * The `@/hooks/useTranslation` mock module used by `useTranslationEnMock`. Test
 * files register it with:
 *   vi.mock("@/hooks/useTranslation", useTranslationEnMock);
 * Backed by the REAL English translation pack, so static-markup tests assert
 * the same strings production renders for EN (missing keys keep the key
 * literal, exactly like the runtime fallback).
 */
export function useTranslationEnMock() {
  const t = (
    key: Parameters<typeof translateAppParams>[0],
    ...args: [Record<string, string | number>?]
  ): string => translateAppParams(key, "en", ...args);
  return () => ({
    language: "en",
    dir: "ltr" as const,
    isRtl: false,
    isLoading: false,
    t,
  });
}
