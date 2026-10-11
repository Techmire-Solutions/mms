import { useEffect, useState } from "react";
import { apiContract } from "@/lib/api";
import { getLlmProviderDefaultModel, type LlmConfig, type LlmProviderType } from "@mms/shared";

interface UseLlmModelFetchOptions {
  formApiKey: string;
  formProvider: LlmProviderType;
  formBaseUrl: string;
  formModel: string;
  modalOpen: boolean;
  editingConfig: LlmConfig | null;
  setFormModel: (value: string) => void;
}

export function useLlmModelFetch({
  formApiKey,
  formProvider,
  formBaseUrl,
  formModel,
  modalOpen,
  editingConfig,
  setFormModel,
}: UseLlmModelFetchOptions) {
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [showCustomModelInput, setShowCustomModelInput] = useState(false);

  useEffect(() => {
    const key = formApiKey.trim();
    if (!key && (!editingConfig || !editingConfig.apiKey)) {
      setFetchedModels([]);
      return;
    }

    const timer = window.setTimeout(() => {
      const fetchModels = async () => {
        setFetchingModels(true);
        try {
          const res = await apiContract.ai.models({
            body: {
              provider: formProvider,
              apiKey: key || undefined,
              configId: editingConfig?.id,
              baseUrl: formBaseUrl.trim() || undefined,
            },
          });
          const status = res.status;
          const body = res.body as { success?: boolean; models?: string[] };
          if (status === 200 && body.success && body.models && body.models.length > 0) {
            const models = body.models;
            setFetchedModels(models);
            setShowCustomModelInput(false);
            if (formModel.trim() === "" || !models.includes(formModel)) {
              const defaultModel = getLlmProviderDefaultModel(formProvider);
              if (models.includes(defaultModel)) {
                setFormModel(defaultModel);
              } else if (!formModel) {
                setFormModel(models[0]);
              }
            }
          } else {
            setFetchedModels([]);
          }
        } catch {
          setFetchedModels([]);
        } finally {
          setFetchingModels(false);
        }
      };
      void fetchModels();
    }, 800);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formApiKey, formProvider, formBaseUrl, modalOpen]);

  return {
    fetchedModels,
    fetchingModels,
    showCustomModelInput,
    setShowCustomModelInput,
    clearFetchedModels: () => setFetchedModels([]),
  };
}
