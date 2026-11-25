import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DEFAULT_WHATSAPP_INTEGRATION,
  listWhatsappProviderPresets,
  type WhatsappIntegrationConfig,
} from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
import { notify } from "@mms/fe-core/notify";
import { mapApiFormError } from "@mms/fe-core/forms/serverFormErrors";
import {
  fetchWhatsappIntegration,
  saveWhatsappIntegration,
  testWhatsappIntegration,
} from "../lib/whatsappIntegrationApi";

// Static provider catalog — resolved once per module, not per render.
const WHATSAPP_PROVIDER_PRESETS = listWhatsappProviderPresets();

export function useWhatsAppIntegrationPanel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const providers = WHATSAPP_PROVIDER_PRESETS;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [form, setForm] = useState<WhatsappIntegrationConfig>(DEFAULT_WHATSAPP_INTEGRATION);
  const [accountSecret, setAccountSecret] = useState("");
  const [testPhone, setTestPhone] = useState("");

  // `loading` already starts true, so the mount fetch only has to clear it when it settles.
  // Each load aborts the previous read and unmount aborts any pending one, so a
  // slow response can never touch stale/unmounted state (sibling email/SMS panels).
  const loadAbortRef = useRef<AbortController | null>(null);
  const load = useCallback(async (): Promise<void> => {
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;
    try {
      const config = await fetchWhatsappIntegration();
      if (controller.signal.aborted) return;
      if (config) {
        setForm(config);
        if (config.senderId) {
          setTestPhone((prev) => prev || config.senderId);
        }
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

  const setField = <K extends keyof WhatsappIntegrationConfig>(
    key: K,
    value: WhatsappIntegrationConfig[K],
  ): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (): Promise<void> => {
    setActionError(null);
    setSaving(true);
    try {
      const effectiveBaseUrl =
        form.apiBaseUrl?.trim() || selectedPreset.baseUrlPlaceholder || undefined;
      const saved = await saveWhatsappIntegration({
        ...form,
        apiBaseUrl: effectiveBaseUrl,
        accountSecret: accountSecret.trim() || undefined,
      });
      setForm(saved);
      setAccountSecret("");
      void queryClient.invalidateQueries({ queryKey: ["whatsapp-integration"] });
      notify.success(t("whatsapp.saveSuccess"), { description: t("whatsapp.saveSuccessDesc") });
    } catch (error) {
      const mapped = mapApiFormError(error);
      setActionError(mapped.message ?? t("whatsapp.saveFailed"));
      notify.error(t("whatsapp.saveFailed"), { description: mapped.message });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (): Promise<void> => {
    const targetPhone = testPhone.trim() || form.senderId.trim();
    if (!targetPhone) {
      notify.error(t("whatsapp.testPhonePlaceholder"));
      return;
    }
    setTesting(true);
    try {
      const effectiveBaseUrl =
        form.apiBaseUrl?.trim() || selectedPreset.baseUrlPlaceholder || undefined;
      const saved = await saveWhatsappIntegration({
        ...form,
        apiBaseUrl: effectiveBaseUrl,
        accountSecret: accountSecret.trim() || undefined,
      });
      setForm(saved);
      if (accountSecret.trim()) setAccountSecret("");

      const config = await testWhatsappIntegration(targetPhone);
      setForm(config);
      void queryClient.invalidateQueries({ queryKey: ["whatsapp-integration"] });
      notify.success(t("whatsapp.testSuccess"), { description: t("whatsapp.testSuccessDesc") });
    } catch (error) {
      const mapped = mapApiFormError(error);
      setActionError(mapped.message ?? t("whatsapp.testFailed"));
      notify.error(t("whatsapp.testFailed"), { description: mapped.message });
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
