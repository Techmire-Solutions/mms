import { useFacultyHost } from "../host.js";

export function useModuleSettingsEditor<T>(options?: unknown): {
  settings: T;
  settingsDraft: T;
  saved: boolean;
  setSaved: (value: boolean | ((curr: boolean) => boolean)) => void;
  upd: <K extends keyof T>(field: K, value: T[K]) => void;
  saveSettingsAsync: () => Promise<void>;
  discardDrafts: () => void;
} {
  return useFacultyHost().useModuleSettingsEditor(options);
}
