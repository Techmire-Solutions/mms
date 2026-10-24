import { useEffect, useRef } from "react";
import { useStudentConfig } from "@/hooks/useStandardModuleConfig";
import { type StudentsSettings } from "@mms/shared";
import { useModuleSettingsEditor } from "@/tenant/hooks/useModuleSettingsEditor";
import { useStudentsSetupSaveActions } from "@/tenant/features/students/hooks/useStudentsSetupSaveActions";

/** Students Setup panel state */
export function useStudentsSetupPanelState() {
  const config = useStudentConfig();
  const { settings, settingsDraft, saved, setSaved, upd, discardDrafts } =
    useModuleSettingsEditor<StudentsSettings>({
      config,
    });

  const { saving, isPrefsDirty, handleSave } = useStudentsSetupSaveActions({
    settings,
    settingsDraft,
    setSaved,
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
    upd,
    saved,
    setSaved,
    saving,
    isPrefsDirty,
    isDirty: isPrefsDirty,
    dirtyRef,
    handleSave,
    discardSetupDrafts,
  };
}
