import React from "react";
import { normalizeEnabledModules, SYSTEM_MODULES_BY_ID } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useSettingsGlobalDraft } from "@/lib/contexts/SettingsGlobalDraftContext";
import { useModuleAccess } from "@/tenant/hooks/useModuleAccess";
import { SettingsFormActions } from "@/components/ui/SettingsFormActions";
import ModuleSettingsNavGrid from "@/tenant/features/settings/components/modules/ModuleSettingsNavGrid";
import { SettingsPanel } from "@/components/ui/SettingsShell";
import { SettingsAdminOnlyNotice } from "@/tenant/features/settings/components/SettingsAdminOnlyNotice";
import { usePermissions } from "@/tenant/hooks/usePermissions";

/**
 * Enable/disable application modules. Layout mirrors app navigation (`SYSTEM_MODULE_NAV`).
 */
export default function SystemModulesSettings(): React.JSX.Element {
  const { t } = useTranslation();
  const { can } = usePermissions();

  const {
    data,
    isModulesDirty,
    saved,
    saving,
    upd,
    handleSaveModules,
    handleDiscardModules,
    clearSaved,
  } = useSettingsGlobalDraft();

  // Platform grants come from the authoritative access snapshot, not a client-side document.
  const { availability } = useModuleAccess();
  const grantedModules = availability
    ? Object.fromEntries(Object.entries(availability).map(([id, entry]) => [id, entry.granted]))
    : undefined;

  const enabledModules = (() => normalizeEnabledModules(data.enabledModules))();

  const updModule = (moduleId: string, enabled: boolean): void => {
    const mod = SYSTEM_MODULES_BY_ID[moduleId];
    if (mod?.required) return;
    upd("enabledModules", normalizeEnabledModules({ ...enabledModules, [moduleId]: enabled }));
    clearSaved();
  };

  if (!can("settings.global.write")) {
    return (
      <SettingsPanel width="wide" introKey="settings.introModules">
        <SettingsAdminOnlyNotice />
      </SettingsPanel>
    );
  }

  return (
    <SettingsPanel
      width="wide"
      introKey="settings.introModules"
      isDirty={isModulesDirty}
      saved={saved}
      footer={
        <SettingsFormActions
          saveLabel={t("module.system.save")}
          savingLabel={t("module.system.saving")}
          onSave={handleSaveModules}
          onDiscard={handleDiscardModules}
          discardLabel={t("theme.discardChanges")}
          dirty={isModulesDirty}
          saving={saving}
          saved={saved}
        />
      }
    >
      <ModuleSettingsNavGrid
        enabledModules={enabledModules}
        grantedModules={grantedModules}
        onToggleModule={updModule}
      />
    </SettingsPanel>
  );
}
