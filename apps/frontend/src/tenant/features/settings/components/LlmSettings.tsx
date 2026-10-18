import React from "react";
import { SettingsFormActions } from "@/components/app/SettingsFormActions";
import { SettingsPanel } from "@/components/app/SettingsShell";
import { SettingsAdminOnlyNotice } from "@/tenant/features/settings/components/SettingsAdminOnlyNotice";
import { usePermissions } from "@/tenant/hooks/usePermissions";
import { LlmConfigListSection } from "./LlmConfigListSection";
import { LlmConfigModal } from "./LlmConfigModal";
import { LlmSandboxPanel } from "./LlmSandboxPanel";
import { useLlmSettingsController } from "../hooks/useLlmSettingsController";

export default function LlmSettings(): React.JSX.Element {
  const { can } = usePermissions();
  const {
    t,
    isGlobalDirty,
    saving,
    saved,
    handleSaveGlobal,
    configListProps,
    sandboxProps,
    modalProps,
  } = useLlmSettingsController();

  if (!can("settings.global.write")) {
    return (
      <SettingsPanel width="medium" introKey="settings.llmDesc">
        <SettingsAdminOnlyNotice />
      </SettingsPanel>
    );
  }

  return (
    <SettingsPanel
      width="medium"
      introKey="settings.llmDesc"
      isDirty={isGlobalDirty}
      saved={saved}
      footer={
        <SettingsFormActions
          saveLabel={t("global.saveSettings")}
          savingLabel={t("global.saving")}
          onSave={() => void handleSaveGlobal()}
          dirty={isGlobalDirty}
          saving={saving}
          saved={saved}
        />
      }
    >
      <div className="space-y-6">
        <LlmConfigListSection {...configListProps} />

        <LlmSandboxPanel {...sandboxProps} />
      </div>

      <LlmConfigModal {...modalProps} />
    </SettingsPanel>
  );
}
