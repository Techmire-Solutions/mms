import { formatLlmSpeed } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useSettingsGlobalDraft } from "@/lib/contexts/SettingsGlobalDraftContext";
import { useLlmHealthChecks } from "./useLlmHealthChecks";
import { useLlmSettingsModal } from "./useLlmSettingsModal";
import { useLlmSettingsSandbox } from "./useLlmSettingsSandbox";
import { useLlmConfigListActions } from "./useLlmConfigListActions";

export function useLlmSettingsController() {
  const { t } = useTranslation();
  const { data, isGlobalDirty, saving, saved, upd, handleSaveGlobal } = useSettingsGlobalDraft();

  const configs = (() => data.llmConfigs ?? [])();

  const { healthStatuses, setHealthStatuses } = useLlmHealthChecks();
  const modal = useLlmSettingsModal({ configs, upd });
  const sandbox = useLlmSettingsSandbox(configs);
  const configList = useLlmConfigListActions({ configs, upd, setHealthStatuses });

  return {
    t,
    isGlobalDirty,
    saving,
    saved,
    handleSaveGlobal,
    configListProps: {
      configs,
      searchQuery: configList.searchQuery,
      setSearchQuery: configList.setSearchQuery,
      healthStatuses,
      testingId: configList.testingId,
      testResult: configList.testResult,
      isGlobalDirty,
      openAddModal: modal.openAddModal,
      openEditModal: modal.openEditModal,
      handleDeleteConfig: configList.handleDeleteConfig,
      handleTestConnection: configList.handleTestConnection,
      formatLlmSpeed,
      t,
    },
    sandboxProps: {
      configs,
      sandboxMessages: sandbox.sandboxMessages,
      setSandboxMessages: sandbox.setSandboxMessages,
      sandboxInput: sandbox.sandboxInput,
      setSandboxInput: sandbox.setSandboxInput,
      sandboxConfigId: sandbox.sandboxConfigId,
      setSandboxConfigId: sandbox.setSandboxConfigId,
      sandboxSystemInstruction: sandbox.sandboxSystemInstruction,
      setSandboxSystemInstruction: sandbox.setSandboxSystemInstruction,
      sandboxTesting: sandbox.sandboxTesting,
      handleSendSandboxMessage: sandbox.handleSendSandboxMessage,
      formatLlmSpeed,
      t,
    },
    modalProps: {
      modalOpen: modal.modalOpen,
      editingConfig: modal.editingConfig,
      formName: modal.formName,
      setFormName: modal.setFormName,
      formProvider: modal.formProvider,
      setFormProvider: modal.setFormProvider,
      formModel: modal.formModel,
      setFormModel: modal.setFormModel,
      formBaseUrl: modal.formBaseUrl,
      setFormBaseUrl: modal.setFormBaseUrl,
      formApiKey: modal.formApiKey,
      setFormApiKey: modal.setFormApiKey,
      formIsDefaultText: modal.formIsDefaultText,
      setFormIsDefaultText: modal.setFormIsDefaultText,
      formTemperature: modal.formTemperature,
      setFormTemperature: modal.setFormTemperature,
      formMaxTokens: modal.formMaxTokens,
      setFormMaxTokens: modal.setFormMaxTokens,
      formTopP: modal.formTopP,
      setFormTopP: modal.setFormTopP,
      fetchedModels: modal.fetchedModels,
      fetchingModels: modal.fetchingModels,
      showCustomModelInput: modal.showCustomModelInput,
      setShowCustomModelInput: modal.setShowCustomModelInput,
      selectedProviderDefaultModel: modal.selectedProviderDefaultModel,
      modalTestResult: modal.modalTestResult,
      modalTesting: modal.modalTesting,
      setModalOpen: modal.setModalOpen,
      handleSaveModalConfig: modal.handleSaveModalConfig,
      handleModalTestConnection: modal.handleModalTestConnection,
      formatLlmSpeed,
      t,
    },
  };
}
