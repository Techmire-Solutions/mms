import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DEFAULT_EMAIL_INTEGRATION,
  listEmailProviderPresets,
  type EmailIntegrationConfig,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import { mapApiFormError } from "@/lib/forms/serverFormErrors";
import {
  fetchEmailIntegration,
  saveEmailIntegration,
  testEmailIntegration,
} from "@/lib/emailIntegrationApi";

export function useEmailIntegrationPanel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const providers = (() => listEmailProviderPresets())();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [form, setForm] = useState<EmailIntegrationConfig>(DEFAULT_EMAIL_INTEGRATION);
  const [smtpPassword, setSmtpPassword] = useState("");
  const [testEmail, setTestEmail] = useState("");

  // `loading` already starts true, so the mount fetch only has to clear it when it settles.
  const load = useCallback(async (): Promise<void> => {
    try {
      const config = await fetchEmailIntegration();
      if (config) {
        setForm(config);
        if (config.fromAddress) {
          setTestEmail((prev) => prev || config.fromAddress);
        }
      }
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
    setActionError(null);
    setSaving(true);
    try {
      const saved = await saveEmailIntegration({
        ...form,
        smtpPassword: smtpPassword.trim() || undefined,
      });
      setForm(saved);
      setSmtpPassword("");
      void queryClient.invalidateQueries({ queryKey: ["email-integration"] });
      notify.success(t("email.saveSuccess"), { description: t("email.saveSuccessDesc") });
    } catch (error) {
      const mapped = mapApiFormError(error);
      setActionError(mapped.message ?? t("email.saveFailed"));
      notify.error(t("email.saveFailed"), { description: mapped.message });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (): Promise<void> => {
    setActionError(null);
    setTesting(true);
    try {
      if (smtpPassword.trim()) {
        const saved = await saveEmailIntegration({ ...form, smtpPassword: smtpPassword.trim() });
        setForm(saved);
        setSmtpPassword("");
      }
      const config = await testEmailIntegration(testEmail.trim() || form.fromAddress);
      setForm(config);
      void queryClient.invalidateQueries({ queryKey: ["email-integration"] });
      notify.success(t("email.testSuccess"), { description: t("email.testSuccessDesc") });
    } catch (error) {
      const mapped = mapApiFormError(error);
      setActionError(mapped.message ?? t("email.testFailed"));
      notify.error(t("email.testFailed"), { description: mapped.message });
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
    testEmail,
    setTestEmail,
    selectedPreset,
    isCustom,
    setField,
    handleSave,
    handleTest,
  };
}
