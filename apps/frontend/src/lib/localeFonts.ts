import type { AppLanguageCode } from "@mms/shared";

const LOCALE_FONT_STYLESHEETS: Partial<Record<AppLanguageCode, string>> = {
  ar: "https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Noto+Sans+Arabic:wght@400;600;700&family=Readex+Pro:wght@400;500;600;700&display=swap",
  ur: "https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Noto+Nastaliq+Urdu:wght@400;700&display=swap",
  fa: "https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700&display=swap",
};

const loadedLocales = new Set<AppLanguageCode>();

/** Loads RTL/locale font sheets on demand — entry pages keep Inter-only CSS. */
export function ensureLocaleFontsLoaded(code: AppLanguageCode): void {
  if (code === "en" || loadedLocales.has(code)) {
    return;
  }

  const href = LOCALE_FONT_STYLESHEETS[code];
  if (!href || typeof document === "undefined") {
    return;
  }

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
  loadedLocales.add(code);
}
