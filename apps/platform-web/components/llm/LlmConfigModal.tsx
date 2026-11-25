import type React from "react";
import { Brain } from "lucide-react";
import { FormModal } from "@mms/fe-core/components/FormModal";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { type LlmConfig, type LlmProviderType, type LlmTestResult } from "@mms/contracts";
import { LlmConfigModalBody } from "./LlmConfigModalBody";

interface LlmConfigModalProps {
  modalOpen: boolean;
  editingConfig: LlmConfig | null;
  formName: string;
  setFormName: (value: string) => void;
  formProvider: LlmProviderType;
  setFormProvider: (value: LlmProviderType) => void;
  formModel: string;
  setFormModel: (value: string) => void;
  formBaseUrl: string;
  setFormBaseUrl: (value: string) => void;
  formApiKey: string;
  setFormApiKey: (value: string) => void;
  formIsDefaultText: boolean;
  setFormIsDefaultText: (value: boolean) => void;
  formTemperature: number;
  setFormTemperature: (value: number) => void;
  formMaxTokens: number;
  setFormMaxTokens: (value: number) => void;
  formTopP: number;
  setFormTopP: (value: number) => void;
  fetchedModels: string[];
  fetchingModels: boolean;
  showCustomModelInput: boolean;
  setShowCustomModelInput: (value: boolean) => void;
  selectedProviderDefaultModel?: string;
  modalTestResult: LlmTestResult | null;
  modalTesting: boolean;
  modalError?: string | null;
  setModalOpen: (open: boolean) => void;
  handleSaveModalConfig: () => void;
  handleModalTestConnection: () => Promise<void>;
  formatLlmSpeed: (wordCount: number, latencyMs: number) => string;
  t: TranslationFunction;
}

export function LlmConfigModal({
  modalOpen,
  editingConfig,
  formName,
  setFormName,
  formProvider,
  setFormProvider,
  formModel,
  setFormModel,
  formBaseUrl,
  setFormBaseUrl,
  formApiKey,
  setFormApiKey,
  formIsDefaultText,
  setFormIsDefaultText,
  formTemperature,
  setFormTemperature,
  formMaxTokens,
  setFormMaxTokens,
  formTopP,
  setFormTopP,
  fetchedModels,
  fetchingModels,
  showCustomModelInput,
  setShowCustomModelInput,
  selectedProviderDefaultModel,
  modalTestResult,
  modalTesting,
  modalError,
  setModalOpen,
  handleSaveModalConfig,
  handleModalTestConnection,
  formatLlmSpeed,
  t,
}: LlmConfigModalProps): React.JSX.Element | null {
  const isDirty = editingConfig
    ? formName !== editingConfig.name ||
      formProvider !== editingConfig.provider ||
      formModel !== editingConfig.model ||
      formBaseUrl !== (editingConfig.baseUrl ?? "") ||
      formIsDefaultText !== editingConfig.isDefaultText ||
      formTemperature !== (editingConfig.temperature ?? 0.7) ||
      formMaxTokens !== (editingConfig.maxTokens ?? 2048) ||
      formTopP !== (editingConfig.topP ?? 0.9) ||
      formApiKey.trim() !== ""
    : formName.trim() !== "" || formBaseUrl.trim() !== "" || formApiKey.trim() !== "";

  return (
    <FormModal
      open={modalOpen}
      onClose={() => setModalOpen(false)}
      title={editingConfig ? t("settings.llmModalEditTitle") : t("settings.llmModalAddTitle")}
      subtitle={t("settings.llmModalDescription")}
      icon={Brain}
      size="md"
      tall
      cancelLabel={t("common.cancel")}
      saveLabel={t("settings.llmModalApplyChanges")}
      onSave={handleSaveModalConfig}
      saveDisabled={!formName.trim()}
      error={modalError ?? undefined}
      isDirty={isDirty}
      formId="llm-config-modal-form"
    >
      <form
        id="llm-config-modal-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (formName.trim()) handleSaveModalConfig();
        }}
      >
        <LlmConfigModalBody
          editingConfig={editingConfig}
          formName={formName}
          setFormName={setFormName}
          formProvider={formProvider}
          setFormProvider={setFormProvider}
          formModel={formModel}
          setFormModel={setFormModel}
          formBaseUrl={formBaseUrl}
          setFormBaseUrl={setFormBaseUrl}
          formApiKey={formApiKey}
          setFormApiKey={setFormApiKey}
          formIsDefaultText={formIsDefaultText}
          setFormIsDefaultText={setFormIsDefaultText}
          formTemperature={formTemperature}
          setFormTemperature={setFormTemperature}
          formMaxTokens={formMaxTokens}
          setFormMaxTokens={setFormMaxTokens}
          formTopP={formTopP}
          setFormTopP={setFormTopP}
          fetchedModels={fetchedModels}
          fetchingModels={fetchingModels}
          showCustomModelInput={showCustomModelInput}
          setShowCustomModelInput={setShowCustomModelInput}
          selectedProviderDefaultModel={selectedProviderDefaultModel}
          modalTestResult={modalTestResult}
          modalTesting={modalTesting}
          handleModalTestConnection={handleModalTestConnection}
          formatLlmSpeed={formatLlmSpeed}
          t={t}
        />
      </form>
    </FormModal>
  );
}
