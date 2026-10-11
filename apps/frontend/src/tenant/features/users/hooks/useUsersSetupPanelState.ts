import { useEffect, useRef } from "react";
import { type UsersSettings } from "@mms/shared";
import { useUsersConfig } from "@/hooks/useStandardModuleConfig";
import { useModuleSettingsEditor } from "@/tenant/hooks/useModuleSettingsEditor";
import { useUsersSetupSaveActions } from "@/tenant/features/users/hooks/useUsersSetupSaveActions";

/** Shared Users Setup editor + dirty/save for Preferences (survives tab switches). */
export function useUsersSetupPanelState() {
  const config = useUsersConfig();
  const { settings, settingsDraft, saved, setSaved, upd, saveSettingsAsync, discardDrafts } =
    useModuleSettingsEditor<UsersSettings>({
      config,
    });

  const { saving, isPrefsDirty, handleSave } = useUsersSetupSaveActions({
    settings,
    settingsDraft,
    setSaved,
    saveSettingsAsync,
  });

  const dirtyRef = useRef({ prefs: false });

  useEffect(() => {
    dirtyRef.current.prefs = isPrefsDirty;
  }, [isPrefsDirty]);

  const discardSetupDrafts = () => {
    discardDrafts();
    dirtyRef.current = { prefs: false };
    setSaved(true);
  };

  return {
    settingsDraft,
    saved,
    setSaved,
    upd,
    saving,
    isPrefsDirty,
    dirtyRef,
    handleSave,
    discardSetupDrafts,
  };
}
