import React from "react";
import { SettingsFormActions } from "@mms/fe-core/components/SettingsFormActions";
import { SettingsPanel } from "@mms/fe-core/components/SettingsShell";
import { SettingsAdminOnlyNotice } from "@mms/fe-core/components/SettingsAdminOnlyNotice";
import { usePermissions } from "@/tenant/hooks/usePermissions";
import { LlmConfigListSection } from "@/components/llm/LlmConfigListSection";
import { LlmConfigModal } from "@/components/llm/LlmConfigModal";
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
      <SettingsPanel width="medium" introKey="settings.llm">
        <SettingsAdminOnlyNotice />
      </SettingsPanel>
    );
  }

  return (
    <SettingsPanel
      width="medium"
      introKey="settings.llm"
      isDirty={isGlobalDirty}
      saved={saved}
      footer={
        <SettingsFormActions
          saveLabel={t("global.saveSettings")}
          savingLabel={t("global.saving")}
          onSave={() => void handleSaveGlobal()}
          dirty={isGlobalDirty}
          saving={saving}
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
