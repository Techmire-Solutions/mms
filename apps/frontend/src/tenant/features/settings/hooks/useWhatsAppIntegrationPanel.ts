import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_WHATSAPP_INTEGRATION,
  listWhatsappProviderPresets,
  type WhatsappIntegrationConfig,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import {
  fetchWhatsappIntegration,
  saveWhatsappIntegration,
  testWhatsappIntegration,
} from "@/lib/whatsappIntegrationApi";

export function useWhatsAppIntegrationPanel() {
  const { t } = useTranslation();
  const providers = (() => listWhatsappProviderPresets())();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [form, setForm] = useState<WhatsappIntegrationConfig>(DEFAULT_WHATSAPP_INTEGRATION);
  const [accountSecret, setAccountSecret] = useState("");
  const [testPhone, setTestPhone] = useState("");

  // `loading` already starts true, so the mount fetch only has to clear it when it settles.
  const load = useCallback(async (): Promise<void> => {
    try {
      const config = await fetchWhatsappIntegration();
      if (config) setForm(config);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedPreset = providers.find((p) => p.id === form.providerId) ?? providers[0];

  const setField = <K extends keyof WhatsappIntegrationConfig>(
    key: K,
    value: WhatsappIntegrationConfig[K],
  ): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    try {
      const saved = await saveWhatsappIntegration({
        ...form,
        accountSecret: accountSecret.trim() || undefined,
      });
      setForm(saved);
      setAccountSecret("");
      notify.success(t("whatsapp.saveSuccess"), { description: t("whatsapp.saveSuccessDesc") });
    } catch (error) {
      notify.error(t("whatsapp.saveFailed"), {
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
        const saved = await saveWhatsappIntegration({
          ...form,
          accountSecret: accountSecret.trim(),
        });
        setForm(saved);
        setAccountSecret("");
      }
      const config = await testWhatsappIntegration(testPhone.trim());
      setForm(config);
      notify.success(t("whatsapp.testSuccess"), { description: t("whatsapp.testSuccessDesc") });
    } catch (error) {
      notify.error(t("whatsapp.testFailed"), {
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
