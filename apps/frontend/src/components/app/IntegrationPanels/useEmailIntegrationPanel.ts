import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_EMAIL_INTEGRATION,
  listEmailProviderPresets,
  validateEmailIntegrationConfig,
  type AppTranslationKey,
  type EmailIntegrationConfig,
  type EmailIntegrationValidationError,
} from "@mms/contracts";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import type { EmailIntegrationApi, ResolveActionError, ResolvedActionError } from "./types";

/** Shared validator error codes → console i18n keys (identical in both consoles). */
const EMAIL_VALIDATION_KEY_MAP: Record<EmailIntegrationValidationError, AppTranslationKey> = {
  invalid_provider: "email.provider",
  invalid_from_address: "email.invalidFromAddress",
  invalid_username: "email.invalidUsername",
  invalid_password: "email.invalidPassword",
  invalid_host: "email.invalidHost",
  invalid_port: "email.invalidPort",
};

export interface EmailIntegrationPanelHookOptions {
  api: EmailIntegrationApi;
  /** Seeds the test-email input from the loaded config (tenant). */
  seedTestTarget?: (config: EmailIntegrationConfig) => string;
  /** Resolves the recipient for the test send; `undefined` sends without one. */
  resolveTestTarget?: (config: EmailIntegrationConfig, testTarget: string) => string | undefined;
  resolveActionError?: ResolveActionError;
  onConfigSaved?: (config: EmailIntegrationConfig) => void;
}

/**
 * Multi-provider SMTP setup panel state (SSOT) shared by the Tenant and
 * Platform consoles. Validation runs through the @mms/contracts
 * `validateEmailIntegrationConfig`; error codes map to `email.*` keys.
 */
export function useEmailIntegrationPanel(options: EmailIntegrationPanelHookOptions) {
  const { t } = useTranslation();
  const optionsRef = useRef(options);
  // Latest-options pattern for the stable `load` callback and the async handlers:
  // the ref is synced in an effect (never during render) so handlers read the
  // options from the render they were invoked after, even under concurrent
  // rendering. Effects flush before any event can fire.
  useEffect(() => {
    optionsRef.current = options;
  });

  const providers = (() => listEmailProviderPresets())();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [form, setForm] = useState<EmailIntegrationConfig>(DEFAULT_EMAIL_INTEGRATION);
  const [smtpPassword, setSmtpPassword] = useState("");
  const [testTarget, setTestTarget] = useState("");

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
        if (seed) setTestTarget((prev) => prev || seed);
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
  const isCustom = form.providerId === "custom_smtp";

  const setField = <K extends keyof EmailIntegrationConfig>(
    key: K,
    value: EmailIntegrationConfig[K],
  ): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validate = (): string | null => {
    const code = validateEmailIntegrationConfig(form, {
      smtpPasswordProvided: smtpPassword.trim() !== "",
    });
    return code ? t(EMAIL_VALIDATION_KEY_MAP[code]) : null;
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
      const saved = await optionsRef.current.api.saveConfig({
        ...form,
        smtpPassword: smtpPassword.trim() || undefined,
      });
      setForm(saved);
      setSmtpPassword("");
      optionsRef.current.onConfigSaved?.(saved);
      notify.success(t("email.saveSuccess"), { description: t("email.saveSuccessDesc") });
    } catch (error) {
      handleActionError(error, "email.saveFailed");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (): Promise<void> => {
    const validationError = validate();
    if (validationError) {
      setActionError(validationError);
      return;
    }
    setActionError(null);
    setTesting(true);
    try {
      if (smtpPassword.trim()) {
        const saved = await optionsRef.current.api.saveConfig({
          ...form,
          smtpPassword: smtpPassword.trim(),
        });
        setForm(saved);
        setSmtpPassword("");
      }
      const target = optionsRef.current.resolveTestTarget?.(form, testTarget);
      const config = await optionsRef.current.api.testConfig(target);
      setForm(config);
      optionsRef.current.onConfigSaved?.(config);
      notify.success(t("email.testSuccess"), { description: t("email.testSuccessDesc") });
    } catch (error) {
      handleActionError(error, "email.testFailed");
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
    smtpPassword,
    setSmtpPassword,
    testTarget,
    setTestTarget,
    selectedPreset,
    isCustom,
    setField,
    handleSave,
    handleTest,
  };
}
