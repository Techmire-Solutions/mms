import { useCallback, useMemo, useState } from "react";
import {
  FACULTY_MODULE_PREFERENCE_KEYS,
  normalizeFacultyModulePreferences,
  type FacultySettings,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import { safeAudit } from "@/lib/safeAudit";
import { useFacultyPreferencesMutation } from "@/tenant/features/faculty/hooks/useFacultySetupConfig";
import { useFacultyMutations } from "@/tenant/features/faculty/hooks/useFaculty";

export function useFacultySetupSaveActions({
  settings,
  settingsDraft,
  setSaved,
}: {
  settings: FacultySettings;
  settingsDraft: FacultySettings;
  setSaved: (value: boolean | ((curr: boolean) => boolean)) => void;
}) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const preferencesMutation = useFacultyPreferencesMutation();
  const { logSetupAudit } = useFacultyMutations();

  const isPrefsDirty = useMemo(() => {
    return FACULTY_MODULE_PREFERENCE_KEYS.some(
      (key) =>
        JSON.stringify(settingsDraft[key as keyof typeof settingsDraft]) !==
        JSON.stringify(settings[key as keyof typeof settings]),
    );
  }, [settingsDraft, settings]);

  const handleSave = useCallback(async (): Promise<void> => {
    if (!isPrefsDirty || saving) return;
    setSaving(true);
    try {
      await preferencesMutation.mutateAsync(normalizeFacultyModulePreferences(settingsDraft));
      safeAudit(
        logSetupAudit.mutateAsync({
          area: "preferences",
          summary: t("faculty.setup.auditSummary", { area: "preferences" }),
        }),
        "faculty.setup_audit",
      );
      notify.success(t("faculty.setup.preferencesSaved"));
      setSaved(true);
    } catch {
      notify.error(t("faculty.setup.saveFailed"));
    } finally {
      setSaving(false);
    }
  }, [isPrefsDirty, saving, preferencesMutation, settingsDraft, logSetupAudit, t, setSaved]);

  return {
    saving,
    isPrefsDirty,
    handleSave,
  };
}
