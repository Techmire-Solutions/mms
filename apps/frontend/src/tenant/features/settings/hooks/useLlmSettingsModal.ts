import { useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import {
  LLM_PROVIDERS_META,
  getLlmProviderDefaultModel,
  resolveLlmModel,
  type LlmConfig,
  type LlmProviderType,
  type LlmTestResult,
} from "@mms/contracts";
import { useLlmModelFetch } from "@/hooks/useLlmModelFetch";

import { computeNextLlmConfigs, testLlmConnectivity } from "../lib/llmSettingsModalHelpers";
import { validateLlmConfigInput } from "@/lib/llmConfigValidation";

interface UseLlmSettingsModalOptions {
  configs: LlmConfig[];
  upd: (key: "llmConfigs", value: LlmConfig[]) => void;
}

export function useLlmSettingsModal({ configs, upd }: UseLlmSettingsModalOptions) {
  const clearErrorOn =
    <T>(setter: (value: T) => void) =>
    (value: T): void => {
      setModalError(null);
      setter(value);
    };

  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<LlmConfig | null>(null);

  const [formName, setFormName] = useState("");
  const [formProvider, setFormProvider] = useState<LlmProviderType>("gemini");
  const [formModel, setFormModel] = useState("");
  const [formBaseUrl, setFormBaseUrl] = useState("");
  const [formApiKey, setFormApiKey] = useState("");
  const [formIsDefaultText, setFormIsDefaultText] = useState(false);
  const [formTemperature, setFormTemperature] = useState(0.7);
  const [formMaxTokens, setFormMaxTokens] = useState(2048);
  const [formTopP, setFormTopP] = useState(0.9);
  const [modalTesting, setModalTesting] = useState(false);
  const [modalTestResult, setModalTestResult] = useState<LlmTestResult | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  const {
    fetchedModels,
    fetchingModels,
    showCustomModelInput,
    setShowCustomModelInput,
    clearFetchedModels,
  } = useLlmModelFetch({
    formApiKey,
    formProvider,
    formBaseUrl,
    formModel,
    modalOpen,
    editingConfig,
    setFormModel: clearErrorOn(setFormModel),
  });

  const resetFormForAdd = () => {
    setEditingConfig(null);
    setFormName("");
    setFormProvider("gemini");
    setFormModel(getLlmProviderDefaultModel("gemini"));
    setFormBaseUrl("");
    setFormApiKey("");
    setFormIsDefaultText(configs.length === 0);
    setFormTemperature(0.7);
    setFormMaxTokens(2048);
    setFormTopP(0.9);
    setModalTestResult(null);
    setShowCustomModelInput(false);
    setModalError(null);
  };

  const openAddModal = () => {
    resetFormForAdd();
    clearFetchedModels();
    setModalOpen(true);
  };

  const openEditModal = (config: LlmConfig) => {
    setEditingConfig(config);
    setFormName(config.name);
    setFormProvider(config.provider);
    setFormModel(config.model);
    setFormBaseUrl(config.baseUrl ?? "");
    setFormApiKey("");
    setFormIsDefaultText(config.isDefaultText);
    setFormTemperature(config.temperature ?? 0.7);
    setFormMaxTokens(config.maxTokens ?? 2048);
    setFormTopP(config.topP ?? 0.9);
    setModalTestResult(null);
    clearFetchedModels();
    setShowCustomModelInput(false);
    setModalError(null);
    setModalOpen(true);
  };

  const validateDraft = (): string | null =>
    validateLlmConfigInput(
      {
        name: formName,
        provider: formProvider,
        model: formModel,
        baseUrl: formBaseUrl,
        apiKey: formApiKey,
        maxTokens: formMaxTokens,
        temperature: formTemperature,
        topP: formTopP,
        editingExisting: Boolean(editingConfig),
      },
      t,
    );

  const handleModalTestConnection = async () => {
    const validationError = validateDraft();
    if (validationError) {
      setModalError(validationError);
      return;
    }
    setModalError(null);
    setModalTesting(true);
    setModalTestResult(null);

    const targetModel = resolveLlmModel(formModel, formProvider);
    const targetApiKey =
      formApiKey.trim() === "" && editingConfig ? editingConfig.apiKey : formApiKey.trim();

    const customConfig = {
      id: editingConfig?.id ?? "temp-config",
      name: formName.trim() || t("settings.llmTemporaryConfig"),
      provider: formProvider,
      model: targetModel,
      baseUrl: formBaseUrl.trim() || undefined,
      apiKey: targetApiKey,
      isDefaultText: formIsDefaultText,
      temperature: formTemperature,
      maxTokens: formMaxTokens,
      topP: formTopP,
    };

    try {
      const result = await testLlmConnectivity(customConfig, t("settings.llmTestConnectionFailed"));
      setModalTestResult(result);
    } finally {
      setModalTesting(false);
    }
  };

  const handleSaveModalConfig = () => {
    const validationError = validateDraft();
    if (validationError) {
      setModalError(validationError);
      return;
    }
    setModalError(null);

    const targetModel = resolveLlmModel(formModel, formProvider);
    const targetApiKey =
      formApiKey.trim() === "" && editingConfig ? editingConfig.apiKey : formApiKey.trim();

    const nextConfig: LlmConfig = {
      id: editingConfig?.id ?? crypto.randomUUID(),
      name: formName.trim(),
      provider: formProvider,
      model: targetModel,
      baseUrl: formBaseUrl.trim() || undefined,
      apiKey: targetApiKey,
      isDefaultText: formIsDefaultText,
      temperature: formTemperature,
      maxTokens: formMaxTokens,
      topP: formTopP,
    };

    const updatedConfigs = computeNextLlmConfigs(configs, nextConfig, Boolean(editingConfig));
    upd("llmConfigs", updatedConfigs);
    setModalOpen(false);
  };

  const selectedProviderMeta = LLM_PROVIDERS_META[formProvider];

  return {
    modalOpen,
    editingConfig,
    formName,
    setFormName: clearErrorOn(setFormName),
    formProvider,
    setFormProvider: clearErrorOn(setFormProvider),
    formModel,
    setFormModel: clearErrorOn(setFormModel),
    formBaseUrl,
    setFormBaseUrl: clearErrorOn(setFormBaseUrl),
    formApiKey,
    setFormApiKey: clearErrorOn(setFormApiKey),
    formIsDefaultText,
    setFormIsDefaultText: clearErrorOn(setFormIsDefaultText),
    formTemperature,
    setFormTemperature: clearErrorOn(setFormTemperature),
    formMaxTokens,
    setFormMaxTokens: clearErrorOn(setFormMaxTokens),
    formTopP,
    setFormTopP: clearErrorOn(setFormTopP),
    fetchedModels,
    fetchingModels,
    showCustomModelInput,
    setShowCustomModelInput,
    selectedProviderDefaultModel: selectedProviderMeta?.defaultModel,
    modalTestResult,
    modalTesting,
    modalError,
    setModalOpen,
    openAddModal,
    openEditModal,
    handleSaveModalConfig,
    handleModalTestConnection,
  };
}
