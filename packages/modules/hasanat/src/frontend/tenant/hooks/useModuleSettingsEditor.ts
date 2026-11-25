import { useHasanatHost } from "../host.js";

export interface ModuleSettingsEditor<T> {
  settings: T;
  settingsDraft: T;
  saved: boolean;
  setSaved: (value: boolean | ((curr: boolean) => boolean)) => void;
  upd: <K extends keyof T>(field: K, value: T[K]) => void;
  saveSettingsAsync: () => Promise<void>;
}

export function useModuleSettingsEditor<T>(options: unknown): ModuleSettingsEditor<T> {
  return useHasanatHost().useModuleSettingsEditor(options) as ModuleSettingsEditor<T>;
}
