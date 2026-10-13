import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_EMAIL_INTEGRATION,
  listEmailProviderPresets,
  type EmailIntegrationConfig,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import {
  fetchEmailIntegration,
  saveEmailIntegration,
  testEmailIntegration,
} from "@/lib/emailIntegrationApi";

export function useEmailIntegrationPanel() {
  const { t } = useTranslation();
  const providers = (() => listEmailProviderPresets())();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [form, setForm] = useState<EmailIntegrationConfig>(DEFAULT_EMAIL_INTEGRATION);
  const [smtpPassword, setSmtpPassword] = useState("");

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const config = await fetchEmailIntegration();
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

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    try {
      const saved = await saveEmailIntegration({
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
    setTesting(true);
    try {
      if (smtpPassword.trim()) {
        const saved = await saveEmailIntegration({ ...form, smtpPassword: smtpPassword.trim() });
        setForm(saved);
        setSmtpPassword("");
      }
      const config = await testEmailIntegration();
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
    smtpPassword,
    setSmtpPassword,
    selectedPreset,
    isCustom,
    setField,
    handleSave,
    handleTest,
  };
}
