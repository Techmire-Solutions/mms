import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_SMS_INTEGRATION,
  listSmsProviderPresets,
  type SmsIntegrationConfig,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import {
  fetchPlatformSmsIntegration,
  savePlatformSmsIntegration,
  testPlatformSmsIntegration,
} from "@/lib/platformSmsIntegrationApi";

export function usePlatformSmsIntegrationPanel() {
  const { t } = useTranslation();
  const providers = (() => listSmsProviderPresets())();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [form, setForm] = useState<SmsIntegrationConfig>(DEFAULT_SMS_INTEGRATION);
  const [accountSecret, setAccountSecret] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      const config = await fetchPlatformSmsIntegration();
      if (config) setForm(config);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedPreset = providers.find((p) => p.id === form.providerId) ?? providers[0];

  const setField = <K extends keyof SmsIntegrationConfig>(
    key: K,
    value: SmsIntegrationConfig[K],
  ): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validate = (phone?: string): string | null => {
    if (!form.providerId) return t("sms.invalidProvider");
    if (!["msg91", "infobip", "logiqueues"].includes(form.providerId) && !form.accountId.trim()) {
      return t("sms.invalidAccountId");
    }
    if (form.providerId !== "logiqueues" && !form.senderId.trim()) {
      return t("sms.invalidSenderId");
    }
    if (!form.hasCredentials && !accountSecret.trim()) return t("sms.invalidSecret");
    if (selectedPreset.requiresBaseUrl) {
      if (!form.apiBaseUrl?.trim()) return t("sms.invalidBaseUrl");
      try {
        new URL(form.apiBaseUrl.trim());
      } catch {
        return t("sms.invalidBaseUrl");
      }
    }
    if (phone !== undefined && !/^\+?\d{7,15}$/.test(phone.trim())) {
      return t("sms.invalidTestPhone");
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
      const saved = await savePlatformSmsIntegration({
        ...form,
        accountSecret: accountSecret.trim() || undefined,
      });
      setForm(saved);
      setAccountSecret("");
      notify.success(t("sms.saveSuccess"), { description: t("sms.saveSuccessDesc") });
    } catch (error) {
      notify.error(t("sms.saveFailed"), {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (): Promise<void> => {
    const validationError = validate(testPhone);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setFormError(null);
    setTesting(true);
    try {
      if (accountSecret.trim()) {
        const saved = await savePlatformSmsIntegration({
          ...form,
          accountSecret: accountSecret.trim(),
        });
        setForm(saved);
        setAccountSecret("");
      }
      const config = await testPlatformSmsIntegration(testPhone.trim());
      setForm(config);
      notify.success(t("sms.testSuccess"), { description: t("sms.testSuccessDesc") });
    } catch (error) {
      notify.error(t("sms.testFailed"), {
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
