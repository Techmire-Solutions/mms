import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_EMAIL_INTEGRATION,
  listEmailProviderPresets,
  type EmailIntegrationConfig,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import {
  fetchPlatformEmailIntegration,
  savePlatformEmailIntegration,
  testPlatformEmailIntegration,
} from "@/lib/platformEmailIntegrationApi";

export function usePlatformEmailIntegrationPanel() {
  const { t } = useTranslation();
  const providers = (() => listEmailProviderPresets())();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [form, setForm] = useState<EmailIntegrationConfig>(DEFAULT_EMAIL_INTEGRATION);
  const [smtpPassword, setSmtpPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      const config = await fetchPlatformEmailIntegration();
      if (config) setForm(config);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
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
    if (!form.providerId?.trim()) return t("email.provider");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.fromAddress?.trim() ?? "")) {
      return t("email.invalidFromAddress");
    }
    if (!form.smtpUsername?.trim()) return t("email.invalidUsername");
    if (!form.hasCredentials && !smtpPassword.trim()) return t("email.invalidPassword");
    if (isCustom) {
      if (!form.smtpHost?.trim()) return t("email.invalidHost");
      if (
        !Number.isInteger(form.smtpPort) ||
        (form.smtpPort ?? 0) < 1 ||
        (form.smtpPort ?? 0) > 65535
      ) {
        return t("email.invalidPort");
      }
    }
    return null;
  };

  const handleSave = async (): Promise<void> => {
    const validationError = validate();
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      const saved = await savePlatformEmailIntegration({
        ...form,
        smtpPassword: smtpPassword.trim() || undefined,
      });
      setForm(saved);
      setSmtpPassword("");
      notify.success(t("email.saveSuccess"), { description: t("email.saveSuccessDesc") });
    } catch (error) {
      notify.error(t("email.saveFailed"), {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (): Promise<void> => {
    const validationError = validate();
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setFormError(null);
    setTesting(true);
    try {
      if (smtpPassword.trim()) {
        const saved = await savePlatformEmailIntegration({
          ...form,
          smtpPassword: smtpPassword.trim(),
        });
        setForm(saved);
        setSmtpPassword("");
      }
      const config = await testPlatformEmailIntegration();
      setForm(config);
      notify.success(t("email.testSuccess"), { description: t("email.testSuccessDesc") });
    } catch (error) {
      notify.error(t("email.testFailed"), {
        description: error instanceof Error ? error.message : undefined,
      });
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
    form,
    formError,
    smtpPassword,
    setSmtpPassword,
    selectedPreset,
    isCustom,
    setField,
    handleSave,
    handleTest,
  };
}
