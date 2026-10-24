import type React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/app/FormSelect";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/app/PasswordInput";
import { Switch } from "@/components/ui/switch";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import {
  LLM_PROVIDERS_META,
  type LlmConfig,
  type LlmProviderType,
  type LlmTestResult,
} from "@mms/shared";
import { LlmConfigModalHyperparameters } from "@/tenant/features/settings/components/LlmConfigModalHyperparameters";
import { LlmModalTestResultBanner } from "@/tenant/features/settings/components/LlmModalTestResultBanner";

export interface LlmConfigModalBodyProps {
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
  handleModalTestConnection: () => Promise<void>;
  formatLlmSpeed: (wordCount: number, latencyMs: number) => string;
  t: TranslationFunction;
}

export function LlmConfigModalBody({
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
  handleModalTestConnection,
  formatLlmSpeed,
  t,
}: LlmConfigModalBodyProps): React.JSX.Element {
  return (
    <>
      <div className="mb-4 max-h-viewport-half min-h-0 flex-1 space-y-4 overflow-y-auto pe-1">
        <div className="space-y-2">
          <Label htmlFor="configName">{t("settings.llmModalName")}</Label>
          <Input
            id="configName"
            name="configName"
            value={formName}
            onChange={(event) => setFormName(event.target.value)}
            placeholder={t("settings.llmModalNamePlaceholder")}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="provider">{t("settings.llmModalProvider")}</Label>
            <FormSelect
              id="provider"
              name="provider"
              value={formProvider}
              onChange={(providerValue) => {
                setFormProvider(providerValue as LlmProviderType);
                const meta = LLM_PROVIDERS_META[providerValue as LlmProviderType];
                if (meta) setFormModel(meta.defaultModel);
              }}
              options={Object.values(LLM_PROVIDERS_META).map((provider) => ({
                value: provider.value,
                label: provider.label,
              }))}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <Label htmlFor="model" className="flex items-center gap-1.5">
                {t("settings.llmModalModelSelect")}
                {fetchingModels && (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                )}
              </Label>
              {fetchedModels.length > 0 && (
                <Button
                  type="button"
                  variant="link"
                  onClick={() => setShowCustomModelInput(!showCustomModelInput)}
                  className="min-h-11 px-2 text-xs font-normal text-primary hover:underline"
                >
                  {showCustomModelInput
                    ? t("settings.llmModalSelectFromList")
                    : t("settings.llmModalTypeManually")}
                </Button>
              )}
            </div>
            {!showCustomModelInput && fetchedModels.length > 0 ? (
              <FormSelect
                id="model"
                name="model"
                value={formModel}
                onChange={setFormModel}
                options={fetchedModels.map((model) => ({ value: model, label: model }))}
              />
            ) : (
              <Input
                id="model"
                name="model"
                value={formModel}
                onChange={(event) => setFormModel(event.target.value)}
                placeholder={selectedProviderDefaultModel}
              />
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="baseUrl" className="flex items-center gap-2">
            {t("settings.llmModalBaseUrl")}
            <span className="rounded bg-muted px-2 py-1 text-xs font-normal text-muted-foreground">
              {t("settings.llmModalOptional")}
            </span>
          </Label>
          <Input
            id="baseUrl"
            name="baseUrl"
            value={formBaseUrl}
            onChange={(event) => setFormBaseUrl(event.target.value)}
            placeholder={t("settings.llmModalBaseUrlPlaceholder")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="apiKey">{t("settings.llmModalApiKey")}</Label>
          <PasswordInput
            id="apiKey"
            name="apiKey"
            value={formApiKey}
            onChange={(event) => setFormApiKey(event.target.value)}
            placeholder={
              editingConfig?.apiKey
                ? t("settings.llmModalApiKeyPlaceholderSaved")
                : t("settings.llmModalApiKeyPlaceholderEmpty")
            }
            autoComplete="off"
            required={false}
          />
        </div>

        <LlmConfigModalHyperparameters
          formTemperature={formTemperature}
          setFormTemperature={setFormTemperature}
          formMaxTokens={formMaxTokens}
          setFormMaxTokens={setFormMaxTokens}
          formTopP={formTopP}
          setFormTopP={setFormTopP}
          t={t}
        />

        <div className="flex items-center justify-between rounded-xl border bg-muted/10 p-4">
          <div className="space-y-1">
            <Label htmlFor="isDefault" className="text-sm font-semibold">
              {t("settings.llmModalSetDefault")}
            </Label>
            <p className="text-xs text-muted-foreground">{t("settings.llmModalSetDefaultDesc")}</p>
          </div>
          <Switch
            id="isDefault"
            name="isDefault"
            checked={formIsDefaultText}
            onCheckedChange={setFormIsDefaultText}
          />
        </div>

        {modalTestResult && (
          <LlmModalTestResultBanner
            modalTestResult={modalTestResult}
            formatLlmSpeed={formatLlmSpeed}
            t={t}
          />
        )}
      </div>

      <div className="flex shrink-0 justify-end border-t border-border bg-card pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => void handleModalTestConnection()}
          disabled={modalTesting || (formApiKey.trim() === "" && !editingConfig)}
          className="min-h-11 w-full px-4 text-xs sm:w-auto"
        >
          {modalTesting ? <Loader2 className="me-2 h-3 w-3 animate-spin" /> : null}
          {t("settings.llmModalTestDraft")}
        </Button>
      </div>
    </>
  );
}
