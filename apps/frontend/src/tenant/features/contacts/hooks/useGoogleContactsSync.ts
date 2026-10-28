import { useState } from "react";
import {
  useContactGoogleSyncConfig,
  useContactGoogleSyncMutations,
} from "@/tenant/features/contacts/hooks/useContacts";
import { useGoogleContactsOAuth } from "@/tenant/features/contacts/hooks/useGoogleContactsOAuth";
import { useInvalidateContactsQueries } from "@/tenant/features/contacts/hooks/useContactMutations";
import { useTranslation } from "@/hooks/useTranslation";
import {
  type AppTranslationKey,
  type ContactGoogleSyncConfigClient,
  type GoogleContactsSyncRunResult,
} from "@mms/shared";
import { reportClientError } from "@/lib/clientErrorReporting";
import { notify } from "@/lib/notify";

function mapGoogleSyncError(error: unknown, translate: (key: AppTranslationKey) => string): string {
  if (typeof error === "object" && error !== null && "status" in error) {
    const err = error as { status?: number; body?: { code?: string } };
    if (err.body?.code === "session_expired") return translate("contacts.sync.sessionExpired");
    if (err.status === 403) return translate("errors.state.permission");
    return translate("contacts.sync.oauthError");
  }
  return translate("contacts.sync.oauthError");
}

export function useGoogleContactsSync({ canWrite = false }: { canWrite?: boolean }) {
  const { t } = useTranslation();
  const invalidateContacts = useInvalidateContactsQueries();
  const { data: serverConfig, isLoading: configLoading } = useContactGoogleSyncConfig({
    enabled: canWrite,
  });
  const { saveConfig, logSyncAudit, exchangeOAuth, runGoogleSync } =
    useContactGoogleSyncMutations();
  const [config, setConfig] = useState<ContactGoogleSyncConfigClient>({});
  const [showSetup, setShowSetup] = useState(false);
  const [form, setForm] = useState({ clientId: "", clientSecret: "" });
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<GoogleContactsSyncRunResult | null>(null);
  const [error, setError] = useState("");
  const [showAuthCode, setShowAuthCode] = useState(false);
  const [authCode, setAuthCode] = useState("");
  const [exchanging, setExchanging] = useState(false);

  const [prevServerConfig, setPrevServerConfig] = useState(serverConfig);
  if (prevServerConfig !== serverConfig) {
    setPrevServerConfig(serverConfig);
    if (serverConfig) {
      setConfig((current) => ({ ...current, clientId: serverConfig.clientId }));
      setForm((current) => ({
        ...current,
        clientId: serverConfig.clientId || current.clientId,
      }));
    }
  }

  const isConfigured = !!(
    config.clientId &&
    (config.clientSecret || serverConfig?.hasClientSecret)
  );
  const isConnected = serverConfig?.isConnected ?? false;

  const { handleConnect, handleExchangeCode } = useGoogleContactsOAuth({
    canWrite,
    config,
    setConfig,
    isConfigured,
    configLoading,
    exchangeOAuth,
    setError,
    setShowAuthCode,
    setAuthCode,
    setExchanging,
    t,
  });

  const handleSaveCredentials = async (): Promise<void> => {
    if (!canWrite) return;
    if (!form.clientId.trim() || !form.clientSecret.trim()) {
      setError(t("contacts.sync.clientIdRequired"));
      return;
    }
    const updatedConfig: ContactGoogleSyncConfigClient = {
      ...config,
      clientId: form.clientId.trim(),
      clientSecret: form.clientSecret.trim(),
    };
    try {
      await saveConfig.mutateAsync(updatedConfig);
      setConfig(updatedConfig);
      setShowSetup(false);
      setError("");
      try {
        await logSyncAudit.mutateAsync({ action: "credentials_saved" });
      } catch (auditError) {
        reportClientError(auditError, { scope: "contacts.googleSync.audit.credentials_saved" });
        notify.warning(t("contacts.sync.auditFailed"));
      }
    } catch (saveError) {
      setError(mapGoogleSyncError(saveError, t));
    }
  };

  const handleSync = async (): Promise<void> => {
    if (!canWrite || !isConnected) return;
    setSyncing(true);
    setSyncResult(null);
    setError("");
    try {
      const result = await runGoogleSync.mutateAsync();
      // Server already persisted imports via bulkSave — invalidate, do not re-upsert.
      invalidateContacts();
      setSyncResult({
        total: result.total,
        imported: result.imported,
        updated: result.updated ?? 0,
        skipped: result.skipped,
        skippedName: result.skippedName ?? 0,
        skippedUnique: result.skippedUnique ?? 0,
      });
    } catch (syncError: unknown) {
      if (
        typeof syncError === "object" &&
        syncError !== null &&
        (syncError as { body?: { code?: string } }).body?.code === "session_expired"
      ) {
        invalidateContacts();
      }
      setError(mapGoogleSyncError(syncError, t));
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async (): Promise<void> => {
    if (!canWrite) return;
    const disconnectedConfig: ContactGoogleSyncConfigClient = {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    };
    try {
      await saveConfig.mutateAsync({ clientId: config.clientId, clearTokens: true });
      setConfig(disconnectedConfig);
      try {
        await logSyncAudit.mutateAsync({ action: "disconnected" });
      } catch (auditError) {
        reportClientError(auditError, { scope: "contacts.googleSync.audit.disconnected" });
        notify.warning(t("contacts.sync.auditFailed"));
      }
      invalidateContacts();
      setSyncResult(null);
      setError("");
      setShowAuthCode(false);
      setAuthCode("");
    } catch (disconnectError) {
      setError(mapGoogleSyncError(disconnectError, t));
    }
  };

  return {
    canWrite,
    form,
    setForm,
    showSetup,
    setShowSetup,
    syncing,
    syncResult,
    error,
    setError,
    showAuthCode,
    authCode,
    setAuthCode,
    exchanging,
    isConfigured,
    isConnected,
    handleSaveCredentials,
    handleConnect,
    handleExchangeCode: () => handleExchangeCode(authCode),
    handleSync,
    handleDisconnect,
  };
}
