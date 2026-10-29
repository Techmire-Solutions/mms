import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_SMS_INTEGRATION,
  listSmsProviderPresets,
  type SmsIntegrationConfig,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import {
  fetchSmsIntegration,
  saveSmsIntegration,
  testSmsIntegration,
} from "@/lib/smsIntegrationApi";

export function useSmsIntegrationPanel() {
  const { t } = useTranslation();
  const providers = (() => listSmsProviderPresets())();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [form, setForm] = useState<SmsIntegrationConfig>(DEFAULT_SMS_INTEGRATION);
  const [accountSecret, setAccountSecret] = useState("");
  const [testPhone, setTestPhone] = useState("");

  // `loading` already starts true, so the mount fetch only has to clear it when it settles.
  const load = useCallback(async (): Promise<void> => {
    try {
      const config = await fetchSmsIntegration();
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

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    try {
      const saved = await saveSmsIntegration({
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
    if (!testPhone.trim()) return;
    setTesting(true);
    try {
      if (accountSecret.trim()) {
        const saved = await saveSmsIntegration({ ...form, accountSecret: accountSecret.trim() });
        setForm(saved);
        setAccountSecret("");
      }
      const config = await testSmsIntegration(testPhone.trim());
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
