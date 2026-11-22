import { useSyncExternalStore } from "react";
import { type GlobalSettings } from "@mms/shared";
import { getScopedGlobalSettings } from "@/lib/settingsPreviewStore";
import { SETTINGS_PREVIEW_EVENT } from "@/lib/settingsPreview";

interface GlobalSettingsSnapshot {
  /** Serialized payload used to detect changes; the merged object is rebuilt per change. */
  raw: string;
  value: GlobalSettings;
}

/**
 * `getScopedGlobalSettings` rebuilds a merged object on every call, so the
 * snapshot is memoized by its serialized payload to satisfy `getSnapshot`'s
 * stable-identity contract.
 */
let cachedSnapshot: GlobalSettingsSnapshot | null = null;

function subscribeToSettingsUpdates(onStoreChange: () => void): () => void {
  const handleUpdate = (): void => onStoreChange();
  window.addEventListener("local-database-update", handleUpdate);
  window.addEventListener("storage", handleUpdate);
  window.addEventListener(SETTINGS_PREVIEW_EVENT, handleUpdate);
  return () => {
    window.removeEventListener("local-database-update", handleUpdate);
    window.removeEventListener("storage", handleUpdate);
    window.removeEventListener(SETTINGS_PREVIEW_EVENT, handleUpdate);
  };
}

function getSettingsSnapshot(): GlobalSettings {
  const next = getScopedGlobalSettings();
  const raw = JSON.stringify(next);
  if (cachedSnapshot && cachedSnapshot.raw === raw) return cachedSnapshot.value;
  cachedSnapshot = { raw, value: next };
  return next;
}

/**
 * Reactive read of `global_settings` — includes live preview overlay; refreshes on save or preview.
 * Subscribes through `useSyncExternalStore` so every consumer shares one snapshot per update.
 * `getServerSnapshot` serves SSR renders (renderToStaticMarkup in tests): it returns the same
 * memoized snapshot so server and client renders agree.
 */
export function useGlobalSettings(): GlobalSettings {
  return useSyncExternalStore(subscribeToSettingsUpdates, getSettingsSnapshot, getSettingsSnapshot);
}
