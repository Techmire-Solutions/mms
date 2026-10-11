import {
  getLanguageDirection,
  getLanguageFontStacks,
  normalizeAppLanguage,
} from '@mms/shared';

/**
 * Applies `lang`, `dir`, and language-specific font CSS variables on `<html>`.
 * Browser-only counterpart to the pure language helpers in `@mms/shared`.
 */
export function applyDocumentLanguage(code: string): void {
  if (typeof document === 'undefined') return;
  const normalized = normalizeAppLanguage(code);
  const root = document.documentElement;
  const fonts = getLanguageFontStacks(normalized);
  root.setAttribute('lang', normalized);
  root.setAttribute('dir', getLanguageDirection(normalized));
  root.style.setProperty('--font-sans', fonts.sans);
  root.style.setProperty('--font-display', fonts.display);
}
