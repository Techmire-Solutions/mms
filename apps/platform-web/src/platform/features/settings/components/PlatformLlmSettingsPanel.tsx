import React from "react";
import { Brain } from "lucide-react";
import { LLM_PROVIDERS_META } from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
import { SettingsFormActions } from "@mms/fe-core/components/SettingsFormActions";
import { SettingsPanel } from "@mms/fe-core/components/SettingsShell";
import { SectionCard } from "@/components/app/SectionCard";
import { Alert } from "@/components/app/Alert";
import { FormSelect } from "@mms/fe-core/components/FormSelect";
import { PasswordInput } from "@mms/fe-core/components/PasswordInput";
import { Label } from "@mms/ui";
import { CardSkeleton } from "@mms/ui";
import { LlmConfigListSection } from "@/components/llm/LlmConfigListSection";
import { LlmConfigModal } from "@/components/llm/LlmConfigModal";
import { usePlatformSettingsQuery } from "@/platform/features/settings/hooks/usePlatformSettings";
import { usePlatformPermissions } from "@/platform/hooks/usePlatformPermissions";
import { usePlatformLlmSettingsController } from "@/platform/features/settings/hooks/usePlatformLlmSettingsController";

/** Platform AI provider configuration used by the Platform AI assistant. */
export default function PlatformLlmSettingsPanel(): React.JSX.Element {
  const { t } = useTranslation();
  const { isSuperUser } = usePlatformPermissions();
  const { data: settings, isLoading } = usePlatformSettingsQuery();
  const controller = usePlatformLlmSettingsController(settings);

  if (!isSuperUser) {
    return (
      <SettingsPanel width="medium" introKey="platform.settings.introLlm">
        <Alert
          tone="warning"
          density="compact"
          role="status"
          icon={Brain}
          description={t("platform.settings.superUserOnly")}
        />
      </SettingsPanel>
    );
  }

  if (isLoading || !settings) return <CardSkeleton count={2} />;

  return (
    <SettingsPanel
      width="medium"
      introKey="platform.settings.introLlm"
      isDirty={controller.isDirty}
      saved={controller.saved}
      footer={
        <SettingsFormActions
          saveLabel={t("global.saveSettings")}
          savingLabel={t("global.saving")}
          onSave={() => void controller.handleSave()}
          onDiscard={controller.handleDiscard}
          discardLabel={t("theme.discardChanges")}
          dirty={controller.isDirty}
          saving={controller.saving}
        />
      }
    >
      <SectionCard
        title={t("platform.settings.llmProviderTitle")}
        subtitle={t("platform.settings.llmProviderDesc")}
        icon={Brain}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="platform-llm-provider" className="text-xs font-medium">
              {t("settings.llmModalProvider")}
            </Label>
            <FormSelect
              id="platform-llm-provider"
              value={controller.provider}
              onChange={(value) => controller.setProvider(value as typeof controller.provider)}
              options={[
                { value: "none", label: t("common.none") },
                ...Object.values(LLM_PROVIDERS_META).map((meta) => ({
                  value: meta.value,
                  label: meta.label,
                })),
              ]}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="platform-llm-key" className="text-xs font-medium">
              {t("settings.llmModalApiKey")}
            </Label>
            <PasswordInput
              id="platform-llm-key"
              value={controller.apiKey}
              onChange={(event) => controller.setApiKey(event.target.value)}
              placeholder={t("settings.llmModalApiKeyPlaceholderEmpty")}
              autoComplete="off"
            />
          </div>
        </div>
      </SectionCard>

      <LlmConfigListSection {...controller.listProps} />
      <LlmConfigModal {...controller.modalProps} />
    </SettingsPanel>
  );
}
