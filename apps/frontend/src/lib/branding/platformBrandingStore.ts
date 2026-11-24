import {
  DEFAULT_PLATFORM_BRANDING,
  mergePlatformBranding,
  normalizeDateFormat,
  normalizeThemeMode,
  normalizeTimezone,
  platformBrandingToBrandingSettings,
  platformPublicBrandingResponseSchema,
  registerSettingsProvider,
  PLATFORM_BRANDING_NAME_FALLBACK,
  type BrandingSettings,
  type DateFormatId,
  type PlatformBrandingSettings,
  type PublicPlatformBranding,
  type ThemeMode,
} from "@mms/shared";
import { apiFetch } from "@/lib/apiClient";
import { isTenantHost } from "@/lib/config/tenantConfig";

const STORAGE_KEY = "mms_platform_branding";
const SETTINGS_EVENT = "mms-platform-branding-update";

export interface PlatformBrandingState {
  branding: PlatformBrandingSettings;
  themeMode: ThemeMode;
  timezone: string;
  dateFormat: string;
  updatedAt?: string;
}

const DEFAULT_STATE: PlatformBrandingState = {
  branding: DEFAULT_PLATFORM_BRANDING,
  themeMode: "system",
  timezone: "UTC",
  dateFormat: "DD/MM/YYYY",
};

let previewBranding: Partial<PlatformBrandingSettings> | null = null;
let previewThemeMode: ThemeMode | null = null;
const listeners = new Set<() => void>();
let state: PlatformBrandingState = loadState();
let hydration: Promise<boolean> | null = null;

function loadState(): PlatformBrandingState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<PlatformBrandingState> | null;
    if (!parsed || typeof parsed !== "object") return DEFAULT_STATE;
    return {
      branding: mergePlatformBranding(parsed.branding ?? null),
      themeMode: normalizeThemeMode(parsed.themeMode),
      timezone: normalizeTimezone(parsed.timezone, DEFAULT_STATE.timezone),
      dateFormat: normalizeDateFormat(parsed.dateFormat, DEFAULT_STATE.dateFormat as DateFormatId),
      ...(parsed.updatedAt ? { updatedAt: parsed.updatedAt } : {}),
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function persist(next: PlatformBrandingState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full/unavailable — keep the in-memory value.
  }
}

/** Points the browser at the white-labelled manifest once branding is custom. */
function syncManifestLink(branding: PlatformBrandingSettings): void {
  if (typeof document === "undefined") return;
  const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (!link) return;
  const isCustom =
    (branding.productName.trim() && branding.productName.trim() !== "MMS") ||
    branding.consoleTitle.trim() !== "" ||
    branding.logoUrl.trim() !== "" ||
    branding.faviconUrl.trim() !== "" ||
    branding.primaryColor !== DEFAULT_PLATFORM_BRANDING.primaryColor;
  link.href = isCustom ? "/api/public/platform-manifest.webmanifest" : "/site.webmanifest";
}

function emit(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SETTINGS_EVENT));
  }
  for (const listener of listeners) listener();
}

/** Subscribes to platform branding/theme updates (apex white-label). */
export function subscribePlatformBranding(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window !== "undefined") window.addEventListener(SETTINGS_EVENT, listener);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener(SETTINGS_EVENT, listener);
  };
}

export function getPlatformBrandingState(): PlatformBrandingState {
  return state;
}

/** Effective (preview-aware) platform branding. */
export function getPlatformBrandingSettings(): PlatformBrandingSettings {
  return mergePlatformBranding(
    previewBranding ? { ...state.branding, ...previewBranding } : state.branding,
  );
}

/** Platform branding adapted to the shared tenant `BrandingSettings` shape. */
export function getPlatformBrandingAsBrandingSettings(): BrandingSettings {
  return platformBrandingToBrandingSettings(getPlatformBrandingSettings());
}

export function getEffectivePlatformThemeMode(): ThemeMode {
  return previewThemeMode ?? state.themeMode;
}

export function getPlatformRegionalSettings(): {
  timezone: string;
  dateFormat: string;
  language: "en";
} {
  return { timezone: state.timezone, dateFormat: state.dateFormat, language: "en" };
}

/** Public product name with translation-independent fallback. */
export function getPlatformProductName(): string {
  return getPlatformBrandingSettings().productName.trim() || PLATFORM_BRANDING_NAME_FALLBACK;
}

export function getPlatformConsoleTitle(): string {
  return getPlatformBrandingSettings().consoleTitle.trim();
}

/** Applies a saved/hydrated state (does not hit the network). */
export function setPlatformBrandingState(next: PlatformBrandingState): void {
  state = {
    branding: mergePlatformBranding(next.branding),
    themeMode: normalizeThemeMode(next.themeMode),
    timezone: normalizeTimezone(next.timezone, DEFAULT_STATE.timezone),
    dateFormat: normalizeDateFormat(next.dateFormat, DEFAULT_STATE.dateFormat as DateFormatId),
    ...(next.updatedAt ? { updatedAt: next.updatedAt } : {}),
  };
  persist(state);
  syncManifestLink(state.branding);
  emit();
}

export function previewPlatformBranding(
  branding: Partial<PlatformBrandingSettings> | null,
  themeMode?: ThemeMode | null,
): void {
  previewBranding = branding;
  previewThemeMode = themeMode ?? null;
  emit();
}

export function clearPlatformBrandingPreview(): void {
  previewBranding = null;
  previewThemeMode = null;
  emit();
}

function toState(payload: {
  branding: PublicPlatformBranding;
  themeMode: ThemeMode;
  timezone: string;
  dateFormat: string;
  updatedAt?: string;
}): PlatformBrandingState {
  return {
    branding: mergePlatformBranding(payload.branding),
    themeMode: normalizeThemeMode(payload.themeMode),
    timezone: normalizeTimezone(payload.timezone, DEFAULT_STATE.timezone),
    dateFormat: normalizeDateFormat(payload.dateFormat, DEFAULT_STATE.dateFormat as DateFormatId),
    ...(payload.updatedAt ? { updatedAt: payload.updatedAt } : {}),
  };
}

/**
 * Fetches the public platform branding (apex boot + after saves). Fail-open: the
 * cached/default branding stays in place when the endpoint is unreachable.
 */
export async function hydratePlatformBranding(force = false): Promise<boolean> {
  if (!force && hydration) return hydration;
  hydration = (async () => {
    try {
      const response = await apiFetch("/api/public/platform-branding", { cache: "no-store" });
      if (!response.ok) return false;
      const parsed = platformPublicBrandingResponseSchema.safeParse(await response.json());
      if (!parsed.success) return false;
      setPlatformBrandingState(toState(parsed.data));
      return true;
    } catch {
      return false;
    } finally {
      hydration = null;
    }
  })();
  return hydration;
}

// Apex only: make shared date formatters follow the instance regional settings.
if (typeof window !== "undefined" && !isTenantHost()) {
  registerSettingsProvider(() => getPlatformRegionalSettings());
}
