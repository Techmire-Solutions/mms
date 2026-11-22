import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_SMS_INTEGRATION,
  listSmsProviderPresets,
  validateSmsIntegrationConfig,
  type AppTranslationKey,
  type SmsIntegrationConfig,
  type SmsIntegrationValidationError,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import type { ResolveActionError, ResolvedActionError, SmsIntegrationApi } from "./types";

/** Shared validator error codes → console i18n keys (identical in both consoles). */
const SMS_VALIDATION_KEY_MAP: Record<SmsIntegrationValidationError, AppTranslationKey> = {
  invalid_provider: "sms.invalidProvider",
  invalid_account_id: "sms.invalidAccountId",
  invalid_sender_id: "sms.invalidSenderId",
  invalid_secret: "sms.invalidSecret",
  invalid_base_url: "sms.invalidBaseUrl",
  invalid_test_phone: "sms.invalidTestPhone",
};

export type SmsIntegrationSavePayload = SmsIntegrationConfig & { accountSecret?: string };

export interface SmsIntegrationPanelHookOptions {
  api: SmsIntegrationApi;
  /** Seeds the test-phone input from the loaded config (tenant). */
  seedTestTarget?: (config: SmsIntegrationConfig) => string;
  /** Payload shaping before save/test (tenant fills the provider base-URL fallback). */
  prepareSaveConfig?: (
    config: SmsIntegrationConfig,
    accountSecret: string,
  ) => SmsIntegrationSavePayload;
  /** Resolves the test recipient (tenant falls back to `senderId`). */
  resolveTestTarget?: (config: SmsIntegrationConfig, testPhone: string) => string;
  /** When set, an empty resolved target notifies this key instead of validating (tenant). */
  testTargetRequiredKey?: AppTranslationKey;
  /** Validate the resolved test target as a phone number (platform). */
  validateTestTarget?: boolean;
  resolveActionError?: ResolveActionError;
  onConfigSaved?: (config: SmsIntegrationConfig) => void;
}

/**
 * One-active-provider SMS setup panel state (SSOT) shared by the Tenant and
 * Platform consoles. Validation runs through the @mms/shared
 * `validateSmsIntegrationConfig`; error codes map to `sms.*` keys.
 */
export function useSmsIntegrationPanel(options: SmsIntegrationPanelHookOptions) {
  const { t } = useTranslation();
  const optionsRef = useRef(options);
  // Latest-options pattern for the stable `load` callback and the async handlers:
  // the ref is synced in an effect (never during render) so handlers read the
  // options from the render they were invoked after, even under concurrent
  // rendering. Effects flush before any event can fire.
  useEffect(() => {
    optionsRef.current = options;
  });

  const providers = (() => listSmsProviderPresets())();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [form, setForm] = useState<SmsIntegrationConfig>(DEFAULT_SMS_INTEGRATION);
  const [accountSecret, setAccountSecret] = useState("");
  const [testPhone, setTestPhone] = useState("");

  // `loading` already starts true, so the mount fetch only has to clear it when it settles.
  // Each load aborts the previous in-flight read; unmount aborts any pending read
  // so a slow response can never touch unmounted state.
  const loadAbortRef = useRef<AbortController | null>(null);
  const load = useCallback(async (): Promise<void> => {
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;
    try {
      const config = await optionsRef.current.api.fetchConfig(controller.signal);
      if (controller.signal.aborted) return;
      if (config) {
        setForm(config);
        const seed = optionsRef.current.seedTestTarget?.(config);
        if (seed) setTestPhone((prev) => prev || seed);
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => loadAbortRef.current?.abort();
  }, [load]);

  const selectedPreset = providers.find((p) => p.id === form.providerId) ?? providers[0];

  const setField = <K extends keyof SmsIntegrationConfig>(
    key: K,
    value: SmsIntegrationConfig[K],
  ): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validate = (target?: string): string | null => {
    const code = validateSmsIntegrationConfig(form, {
      requiresBaseUrl: selectedPreset.requiresBaseUrl,
      accountSecretProvided: accountSecret.trim() !== "",
      ...(optionsRef.current.validateTestTarget && target !== undefined
        ? { testPhone: target }
        : {}),
    });
    return code ? t(SMS_VALIDATION_KEY_MAP[code]) : null;
  };

  const buildSavePayload = (secret: string): SmsIntegrationSavePayload => {
    const prepare = optionsRef.current.prepareSaveConfig;
    return prepare ? prepare(form, secret) : { ...form, accountSecret: secret.trim() || undefined };
  };

  const handleActionError = (error: unknown, failedKey: AppTranslationKey): void => {
    const resolved =
      optionsRef.current.resolveActionError?.(error, failedKey) ??
      ({
        description: error instanceof Error ? error.message : undefined,
      } satisfies ResolvedActionError);
    setActionError(resolved.inlineMessage ?? null);
    notify.error(t(failedKey), { description: resolved.description });
  };

  const handleSave = async (): Promise<void> => {
    const validationError = validate();
    if (validationError) {
      setActionError(validationError);
      return;
    }
    setActionError(null);
    setSaving(true);
    try {
      const saved = await optionsRef.current.api.saveConfig(buildSavePayload(accountSecret));
      setForm(saved);
      setAccountSecret("");
      optionsRef.current.onConfigSaved?.(saved);
      notify.success(t("sms.saveSuccess"), { description: t("sms.saveSuccessDesc") });
    } catch (error) {
      handleActionError(error, "sms.saveFailed");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (): Promise<void> => {
    const target = optionsRef.current.resolveTestTarget?.(form, testPhone) ?? testPhone.trim();
    if (!target) {
      notify.error(t(optionsRef.current.testTargetRequiredKey ?? "sms.testPhonePlaceholder"));
      return;
    }
    const validationError = validate(target);
    if (validationError) {
      setActionError(validationError);
      return;
    }
    setActionError(null);
    setTesting(true);
    try {
      if (accountSecret.trim()) {
        const saved = await optionsRef.current.api.saveConfig(buildSavePayload(accountSecret));
        setForm(saved);
        setAccountSecret("");
      }
      const config = await optionsRef.current.api.testConfig(target);
      setForm(config);
      optionsRef.current.onConfigSaved?.(config);
      notify.success(t("sms.testSuccess"), { description: t("sms.testSuccessDesc") });
    } catch (error) {
      handleActionError(error, "sms.testFailed");
    } finally {
      setTesting(false);
    }
  };

  return {
    t,
    providers,
    loading,
    saving,
    testing,
    actionError,
    form,
    accountSecret,
    setAccountSecret,
    testPhone,
    setTestPhone,
    selectedPreset,
    setField,
    handleSave,
    handleTest,
  };
}
