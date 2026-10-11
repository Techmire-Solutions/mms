import {
  BRANDING_THEME_VARIABLES,
  brandingPrimaryToThemeColor,
  buildBrandingCssVariables,
  normalizeAppLanguage,
  normalizeBrandingCornerStyle,
  resolveBrandingCornerRadius,
  type BrandingSettings,
  type BrandingThemeMode,
  type GlobalSettings,
} from '@mms/shared';
import { applyDocumentLanguage } from '@/lib/documentLanguage';
import { ensureLocaleFontsLoaded } from '@/lib/localeFonts';

function resolveThemeMode(settings: GlobalSettings): BrandingThemeMode {
  if (settings.theme === 'dark') return 'dark';
  if (settings.theme === 'light') return 'light';
  if (typeof document === 'undefined') return 'light';
  const root = document.documentElement;
  return root.classList.contains('dark') ? 'dark' : 'light';
}

function syncDocumentChrome(mode: BrandingThemeMode, primaryHex: string): void {
  const root = document.documentElement;
  root.style.colorScheme = mode;
  root.dataset.theme = mode;

  const themeColor = brandingPrimaryToThemeColor(primaryHex);
  let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = themeColor;
}

/** Applies branding tokens from explicit settings — no localStorage / db imports. */
export function applyBrandingFromSettings(
  branding: BrandingSettings,
  mode: BrandingThemeMode,
): void {
  const root = document.documentElement;
  const variables = buildBrandingCssVariables(
    branding.primaryColor,
    branding.secondaryColor,
    mode,
  );

  for (const key of BRANDING_THEME_VARIABLES) {
    const value = variables[key];
    if (value) root.style.setProperty(key, value);
  }

  const cornerStyle = normalizeBrandingCornerStyle(branding.cornerStyle);
  root.style.setProperty('--radius', resolveBrandingCornerRadius(cornerStyle));
  syncDocumentChrome(mode, branding.primaryColor);
}

function applyDocumentLanguageWithFonts(language: string): void {
  const normalized = normalizeAppLanguage(language);
  applyDocumentLanguage(normalized);
  ensureLocaleFontsLoaded(normalized);
}

/** Applies an explicit host theme without reading tenant or platform state. */
export function applyDocumentTheme(
  branding: BrandingSettings,
  theme: GlobalSettings['theme'],
  language: string,
): void {
  const activeTheme = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;
  document.documentElement.classList.toggle('dark', activeTheme === 'dark');
  applyDocumentLanguageWithFonts(language);
  applyBrandingFromSettings(branding, activeTheme);
}

export { resolveThemeMode, syncDocumentChrome, applyDocumentLanguageWithFonts };
