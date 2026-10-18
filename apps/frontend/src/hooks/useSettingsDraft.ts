import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

export interface UseSettingsDraftOptions<T> {
  load: () => T;
  /** Called whenever draft changes — apply live preview (theme, nav, branding, etc.). */
  onPreview: (draft: T) => void;
  /** Persist draft to database on explicit Save. */
  onSave: (draft: T) => void | Promise<void>;
  /** Reset draft when `local-database-update` fires (external save/sync). */
  syncOnDatabaseUpdate?: boolean;
  /** Skip external sync while the user has unsaved draft edits. */
  skipDatabaseSyncWhenDirty?: boolean;
}

/**
 * Standard settings form state: draft + dirty flag + live preview on change, persist on Save.
 */
export function useSettingsDraft<T>({
  load,
  onPreview,
  onSave,
  syncOnDatabaseUpdate = true,
  skipDatabaseSyncWhenDirty = false,
}: UseSettingsDraftOptions<T>): {
  data: T;
  dirty: boolean;
  saving: boolean;
  setData: Dispatch<SetStateAction<T>>;
  upd: <K extends keyof T>(field: K, value: T[K]) => void;
  handleSave: () => Promise<void>;
  resetDraft: () => void;
} {
  const [data, setData] = useState<T>(load);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!syncOnDatabaseUpdate) return;
    const sync = (): void => {
      if (skipDatabaseSyncWhenDirty && dirty) return;
      setData(load());
      setDirty(false);
    };
    window.addEventListener("local-database-update", sync);
    return () => window.removeEventListener("local-database-update", sync);
  }, [load, syncOnDatabaseUpdate, skipDatabaseSyncWhenDirty, dirty]);

  useEffect(() => {
    onPreview(data);
  }, [data, onPreview]);

  const upd = <K extends keyof T>(field: K, value: T[K]): void => {
    setData((current) => ({ ...current, [field]: value }));
    setDirty(true);
  };

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    try {
      await onSave(data);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  const resetDraft = (): void => {
    setData(load());
    setDirty(false);
  };

  return { data, dirty, saving, setData, upd, handleSave, resetDraft };
}
