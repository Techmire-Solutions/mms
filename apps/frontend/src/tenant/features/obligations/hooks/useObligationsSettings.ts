import { useCallback, useSyncExternalStore } from "react";
import {
  DEFAULT_OBLIGATIONS_SETTINGS,
  OBLIGATIONS_MODULE_MANIFEST,
  type ObligationsSettings,
} from "@mms/shared";
import { getObject, saveObject } from "@/lib/db";

const STORAGE_KEY = OBLIGATIONS_MODULE_MANIFEST.settingsObjectKey;
export const OBLIGATIONS_SETTINGS_CHANGED_EVENT = "mms:obligations-settings-changed";

let cachedSettings: ObligationsSettings | null = null;
const listeners = new Set<() => void>();

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

export function loadObligationsSettings(): ObligationsSettings {
  return getObject<ObligationsSettings>(STORAGE_KEY, DEFAULT_OBLIGATIONS_SETTINGS);
}

export function saveObligationsSettings(settings: ObligationsSettings): void {
  saveObject(STORAGE_KEY, settings);
  cachedSettings = settings;
  notifyListeners();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OBLIGATIONS_SETTINGS_CHANGED_EVENT, { detail: settings }));
  }
}

function handleWindowUpdate(e?: Event): void {
  if (e instanceof CustomEvent && e.detail && typeof e.detail === "object") {
    cachedSettings = e.detail as ObligationsSettings;
  } else {
    cachedSettings = loadObligationsSettings();
  }
  notifyListeners();
}

function handleStorage(e: StorageEvent): void {
  if (e.key === STORAGE_KEY) {
    cachedSettings = loadObligationsSettings();
    notifyListeners();
  }
}

let listenersInitialized = false;
function setupGlobalListeners(): void {
  if (listenersInitialized || typeof window === "undefined") return;
  window.addEventListener(OBLIGATIONS_SETTINGS_CHANGED_EVENT, handleWindowUpdate);
  window.addEventListener("storage", handleStorage);
  listenersInitialized = true;
}

function getSettingsSnapshot(): ObligationsSettings {
  if (!cachedSettings) {
    cachedSettings = loadObligationsSettings();
  }
  return cachedSettings;
}

function subscribeSettings(callback: () => void): () => void {
  setupGlobalListeners();
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export interface UseObligationsSettingsReturn {
  settings: ObligationsSettings;
  updateSettings: (next: ObligationsSettings) => void;
  resetSettings: () => void;
}

export function useObligationsSettings(): UseObligationsSettingsReturn {
  const settings = useSyncExternalStore(
    subscribeSettings,
    getSettingsSnapshot,
    () => DEFAULT_OBLIGATIONS_SETTINGS,
  );

  const updateSettings = useCallback((next: ObligationsSettings) => {
    saveObligationsSettings(next);
  }, []);

  const resetSettings = useCallback(() => {
    saveObligationsSettings(DEFAULT_OBLIGATIONS_SETTINGS);
  }, []);

  return { settings, updateSettings, resetSettings };
}
