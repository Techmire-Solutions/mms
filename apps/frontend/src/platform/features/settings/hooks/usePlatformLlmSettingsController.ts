import { useCallback, useMemo, useState } from "react";
import {
  LLM_PROVIDERS_META,
  formatLlmSpeed,
  getLlmProviderDefaultModel,
  resolveLlmModel,
  type LlmConfig,
  type LlmProviderType,
  type LlmTestResult,
  type PlatformSettings,
} from "@mms/contracts";
import { useTranslation } from "@/hooks/useTranslation";
import { useSavedFlash } from "@/hooks/useSavedFlash";
import { validateLlmConfigInput } from "@/lib/llmConfigValidation";
import {
  useTestPlatformLlm,
  useUpdatePlatformLlm,
} from "@/platform/features/settings/hooks/usePlatformLlm";
import { getPlatformErrorMessage } from "@/platform/features/auth/lib/platformAuthErrors";
import { notify } from "@/lib/notify";
import { apiContract } from "@/lib/api";
import { useLlmModelFetch, type LlmModelFetchRequest } from "@/hooks/useLlmModelFetch";
import {
  EMPTY_PLATFORM_LLM_FORM,
  type PlatformLlmHealthStatus,
  type PlatformLlmModalForm,
} from "@/platform/features/settings/lib/platformLlmSettingsTypes";

/** Local controller for the platform LLM settings panel (list + modal + tests). */
export function usePlatformLlmSettingsController(settings: PlatformSettings | undefined) {
  const { t } = useTranslation();
  const { saved, flashSaved } = useSavedFlash();
  const updateLlm = useUpdatePlatformLlm();
  const testLlm = useTestPlatformLlm();
  const [configs, setConfigs] = useState<LlmConfig[] | null>(null);
  const [provider, setProvider] = useState<LlmProviderType | "none">("none");
  const [apiKey, setApiKey] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [healthStatuses, setHealthStatuses] = useState<Record<string, PlatformLlmHealthStatus>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<LlmTestResult | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<LlmConfig | null>(null);
  const [form, setForm] = useState<PlatformLlmModalForm>(EMPTY_PLATFORM_LLM_FORM);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalTestResult, setModalTestResult] = useState<LlmTestResult | null>(null);
  const [modalTesting, setModalTesting] = useState(false);
  const [prevSettings, setPrevSettings] = useState(settings);
  const fetchPlatformModels = useCallback(
    async (input: LlmModelFetchRequest, signal: AbortSignal) => {
      const res = await apiContract.platform.getLlmModels({ body: input, signal });
      const body = res.body as { models?: string[] } | undefined;
      return { success: res.status === 200, models: body?.models ?? [] };
    },
    [],
  );
  const { fetchedModels, fetchingModels, showCustomModelInput, setShowCustomModelInput } =
    useLlmModelFetch({
      formApiKey: form.apiKey,
      formProvider: form.provider,
      formBaseUrl: form.baseUrl,
      formModel: form.model,
      modalOpen,
      editingConfig,
      setFormModel: (value) => setForm((current) => ({ ...current, model: value })),
      fetchModels: fetchPlatformModels,
    });
  const serverConfigs = useMemo(() => settings?.llmConfigs ?? [], [settings?.llmConfigs]);
  const isDirty =
    configs !== null &&
    (JSON.stringify(configs) !== JSON.stringify(serverConfigs) ||
      provider !== (settings?.llmProvider ?? "none") ||
      apiKey !== (settings?.llmApiKey ?? ""));
  if (settings !== prevSettings) {
    setPrevSettings(settings);
    if (settings && (!configs || !isDirty)) {
      setConfigs(settings.llmConfigs);
      setProvider(settings.llmProvider);
      setApiKey(settings.llmApiKey);
    }
  }

  const resolvedConfigs = useMemo(() => configs ?? serverConfigs, [configs, serverConfigs]);
  const openAddModal = (): void => {
    setEditingConfig(null);
    setForm(EMPTY_PLATFORM_LLM_FORM);
    setModalError(null);
    setModalTestResult(null);
    setShowCustomModelInput(false);
    setModalOpen(true);
  };

  const openEditModal = (config: LlmConfig): void => {
    setEditingConfig(config);
    setForm({
      name: config.name,
      provider: config.provider,
      model: config.model,
      baseUrl: config.baseUrl ?? "",
      apiKey: config.apiKey,
      isDefaultText: config.isDefaultText,
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 2048,
      topP: config.topP ?? 0.9,
    });
    setModalError(null);
    setModalTestResult(null);
    setShowCustomModelInput(false);
    setModalOpen(true);
  };

  const updateForm = <K extends keyof PlatformLlmModalForm>(
    key: K,
    value: PlatformLlmModalForm[K],
  ): void => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const setFormProvider = (next: LlmProviderType): void => {
    setForm((current) => ({
      ...current,
      provider: next,
      model: getLlmProviderDefaultModel(next),
    }));
  };

  const saveModalConfig = (): void => {
    const error = validateLlmConfigInput(
      {
        name: form.name,
        provider: form.provider,
        model: form.model,
        baseUrl: form.baseUrl,
        apiKey: form.apiKey,
        maxTokens: form.maxTokens,
        temperature: form.temperature,
        topP: form.topP,
        editingExisting: Boolean(editingConfig),
      },
      t,
    );
    if (error) {
      setModalError(error);
      return;
    }
    const nextConfig: LlmConfig = {
      id: editingConfig?.id ?? `platform-${Date.now()}`,
      name: form.name.trim(),
      provider: form.provider,
      apiKey: form.apiKey,
      model: resolveLlmModel(form.model, form.provider),
      ...(form.baseUrl.trim() ? { baseUrl: form.baseUrl.trim() } : {}),
      isDefaultText: form.isDefaultText,
      temperature: form.temperature,
      maxTokens: form.maxTokens,
      topP: form.topP,
    };
    setConfigs((current) => {
      const base = current ?? serverConfigs;
      const next = editingConfig
        ? base.map((config) => (config.id === editingConfig.id ? nextConfig : config))
        : [...base, nextConfig];
      return form.isDefaultText
        ? next.map((config) => ({ ...config, isDefaultText: config.id === nextConfig.id }))
        : next;
    });
    setModalOpen(false);
  };

  const deleteConfig = (configId: string): void => {
    setConfigs((current) => (current ?? serverConfigs).filter((config) => config.id !== configId));
  };

  const testConnection = async (configId: string): Promise<void> => {
    setTestingId(configId);
    setHealthStatuses((current) => ({ ...current, [configId]: "testing" }));
    try {
      const result = await testLlm.mutateAsync({ configId });
      setTestResult(result);
      setHealthStatuses((current) => ({
        ...current,
        [configId]: result.success ? "verified" : "failed",
      }));
    } catch {
      setHealthStatuses((current) => ({ ...current, [configId]: "failed" }));
    } finally {
      setTestingId(null);
    }
  };

  const testModalConnection = async (): Promise<void> => {
    setModalTesting(true);
    try {
      const result = await testLlm.mutateAsync({
        customConfig: {
          id: editingConfig?.id ?? "platform-new",
          name: form.name || "Untitled",
          provider: form.provider,
          apiKey: form.apiKey,
          model: form.model,
          ...(form.baseUrl.trim() ? { baseUrl: form.baseUrl.trim() } : {}),
          isDefaultText: form.isDefaultText,
          temperature: form.temperature,
          maxTokens: form.maxTokens,
          topP: form.topP,
        },
      });
      setModalTestResult(result);
    } catch (error) {
      setModalTestResult({ success: false, message: getPlatformErrorMessage(error, t) });
    } finally {
      setModalTesting(false);
    }
  };

  const handleDiscard = (): void => {
    if (!settings) return;
    setConfigs(settings.llmConfigs);
    setProvider(settings.llmProvider);
    setApiKey(settings.llmApiKey);
  };

  const handleSave = async (): Promise<void> => {
    try {
      await updateLlm.mutateAsync({
        llmProvider: provider,
        llmApiKey: apiKey,
        llmConfigs: resolvedConfigs,
        ...(settings?.updatedAt ? { expectedUpdatedAt: settings.updatedAt } : {}),
      });
      flashSaved();
    } catch (error) {
      notify.error(getPlatformErrorMessage(error, t));
    }
  };

  return {
    t,
    saved,
    isDirty,
    saving: updateLlm.isPending,
    provider,
    setProvider,
    apiKey,
    setApiKey,
    handleDiscard,
    handleSave,
    listProps: {
      configs: resolvedConfigs,
      searchQuery,
      setSearchQuery,
      healthStatuses,
      testingId,
      testResult,
      isGlobalDirty: isDirty,
      openAddModal,
      openEditModal,
      handleDeleteConfig: deleteConfig,
      handleTestConnection: testConnection,
      formatLlmSpeed,
      t,
    },
    modalProps: {
      modalOpen,
      editingConfig,
      formName: form.name,
      setFormName: (value: string) => updateForm("name", value),
      formProvider: form.provider,
      setFormProvider,
      formModel: form.model,
      setFormModel: (value: string) => updateForm("model", value),
      formBaseUrl: form.baseUrl,
      setFormBaseUrl: (value: string) => updateForm("baseUrl", value),
      formApiKey: form.apiKey,
      setFormApiKey: (value: string) => updateForm("apiKey", value),
      formIsDefaultText: form.isDefaultText,
      setFormIsDefaultText: (value: boolean) => updateForm("isDefaultText", value),
      formTemperature: form.temperature,
      setFormTemperature: (value: number) => updateForm("temperature", value),
      formMaxTokens: form.maxTokens,
      setFormMaxTokens: (value: number) => updateForm("maxTokens", value),
      formTopP: form.topP,
      setFormTopP: (value: number) => updateForm("topP", value),
      fetchedModels,
      fetchingModels,
      showCustomModelInput,
      setShowCustomModelInput,
      selectedProviderDefaultModel: LLM_PROVIDERS_META[form.provider]?.defaultModel,
      modalTestResult,
      modalTesting,
      modalError,
      setModalOpen,
      handleSaveModalConfig: saveModalConfig,
      handleModalTestConnection: testModalConnection,
      formatLlmSpeed,
      t,
    },
  };
}
