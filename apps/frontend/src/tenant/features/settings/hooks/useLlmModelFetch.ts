import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
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

interface FetchedModelsSnapshot {
  list: string[];
  /** Fetch inputs the list was produced for — a stale snapshot is never rendered. */
  scope: string;
}

const EMPTY_MODELS_SNAPSHOT: FetchedModelsSnapshot = { list: [], scope: "" };
const MODEL_FETCH_DEBOUNCE_MS = 800;

function modelFetchScope(
  configId: string | undefined,
  key: string,
  savedApiKey: string,
  provider: LlmProviderType,
  baseUrl: string,
): string {
  return `${configId ?? ""}|${key}|${savedApiKey}|${provider}|${baseUrl}`;
}

/**
 * Debounced provider model listing for the LLM config modal.
 *
 * The fetched list is scoped to the exact inputs that produced it (trimmed key,
 * saved key, config id, provider, base URL), so changed inputs immediately stop
 * showing another configuration's models while the next request is debounced.
 * In-flight requests are aborted when the inputs change — a late response can
 * never overwrite the newer listing.
 */
export function useLlmModelFetch({
  formApiKey,
  formProvider,
  formBaseUrl,
  formModel,
  modalOpen,
  editingConfig,
  setFormModel,
}: UseLlmModelFetchOptions) {
  const [snapshot, setSnapshot] = useState<FetchedModelsSnapshot>(EMPTY_MODELS_SNAPSHOT);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [showCustomModelInput, setShowCustomModelInput] = useState(false);

  // Mirror the draft model for the async completion below (effect-only read)
  // so typing in the model input never restarts the debounced fetch.
  const formModelRef = useRef(formModel);
  useEffect(() => {
    formModelRef.current = formModel;
  }, [formModel]);

  // Effect event: the upstream setter identity changes per render; this keeps it
  // out of the fetch effect's deps while always calling the latest one.
  const applyFetchedModels = useEffectEvent(
    (models: string[], fetchedScope: string, provider: LlmProviderType) => {
      setSnapshot({ list: models, scope: fetchedScope });
      setShowCustomModelInput(false);
      const currentModel = formModelRef.current;
      if (currentModel.trim() === "" || !models.includes(currentModel)) {
        const defaultModel = getLlmProviderDefaultModel(provider);
        if (models.includes(defaultModel)) {
          setFormModel(defaultModel);
        } else if (!currentModel) {
          setFormModel(models[0]);
        }
      }
    },
  );

  const key = formApiKey.trim();
  const savedApiKey = editingConfig?.apiKey ?? "";
  const configId = editingConfig?.id;
  const baseUrl = formBaseUrl.trim();
  const hasApiKey = Boolean(key) || Boolean(savedApiKey);

  useEffect(() => {
    if (!modalOpen || !hasApiKey) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void (async () => {
        setFetchingModels(true);
        try {
          const fetchedScope = modelFetchScope(configId, key, savedApiKey, formProvider, baseUrl);
          const res = await apiContract.ai.models({
            body: {
              provider: formProvider,
              apiKey: key || undefined,
              configId,
              baseUrl: baseUrl || undefined,
            },
            signal: controller.signal,
          });
          if (controller.signal.aborted) return;
          const status = res.status;
          const body = res.body as { success?: boolean; models?: string[] };
          if (status === 200 && body.success && body.models && body.models.length > 0) {
            applyFetchedModels(body.models, fetchedScope, formProvider);
          } else {
            setSnapshot(EMPTY_MODELS_SNAPSHOT);
          }
        } catch {
          if (!controller.signal.aborted) {
            setSnapshot(EMPTY_MODELS_SNAPSHOT);
          }
        } finally {
          setFetchingModels(false);
        }
      })();
    }, MODEL_FETCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [modalOpen, hasApiKey, key, savedApiKey, configId, formProvider, baseUrl]);

  const clearFetchedModels = useCallback(() => setSnapshot(EMPTY_MODELS_SNAPSHOT), []);

  const currentScope = modelFetchScope(configId, key, savedApiKey, formProvider, baseUrl);
  const fetchedModels = hasApiKey && snapshot.scope === currentScope ? snapshot.list : [];

  return {
    fetchedModels,
    fetchingModels,
    showCustomModelInput,
    setShowCustomModelInput,
    clearFetchedModels,
  };
}
