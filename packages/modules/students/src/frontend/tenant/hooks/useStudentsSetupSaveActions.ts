import { useState } from "react";
import {
  STUDENT_MODULE_PREFERENCE_KEYS,
  normalizeStudentModulePreferences,
  type StudentsSettings,
} from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
import { notify } from "@mms/fe-core/notify";
import { safeAudit } from "@mms/fe-core/lib/safeAudit";
import { useStudentPreferencesMutation } from "./useStudentSetupConfig";
import { useStudentMutations } from "./useStudentMutations";

export function useStudentsSetupSaveActions({
  settings,
  settingsDraft,
  setSaved,
}: {
  settings: StudentsSettings;
  settingsDraft: StudentsSettings;
  setSaved: (value: boolean | ((curr: boolean) => boolean)) => void;
}) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const preferencesMutation = useStudentPreferencesMutation();
  const { logSetupAudit } = useStudentMutations();

  const isPrefsDirty = (() => {
    return STUDENT_MODULE_PREFERENCE_KEYS.some(
      (key) =>
        JSON.stringify(Reflect.get(settingsDraft, key)) !==
        JSON.stringify(Reflect.get(settings, key)),
    );
  })();

  const handleSave = async (): Promise<void> => {
    if (!isPrefsDirty || saving) return;
    setSaving(true);
    try {
      await preferencesMutation.mutateAsync(normalizeStudentModulePreferences(settingsDraft));
      safeAudit(
        logSetupAudit.mutateAsync({
          area: "preferences",
          summary: t("students.setup.auditSummary", { area: "preferences" }),
        }),
        "students.setup_audit",
      );
      notify.success(t("students.setup.preferencesSaved"));
      setSaved(true);
    } catch {
      notify.error(t("students.setup.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return {
    saving,
    isPrefsDirty,
    handleSave,
  };
}
