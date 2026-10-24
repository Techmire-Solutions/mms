import { useCallback, useEffect, type Dispatch, type SetStateAction } from "react";
import {
  GOOGLE_CONTACTS_OAUTH_MESSAGE,
  takeGoogleContactsOAuthCode,
} from "@/lib/contacts/googleContactsOAuth";
import type { ContactGoogleSyncConfigClient } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

type ExchangeOAuthMutation = {
  mutateAsync: (input: {
    code: string;
    redirectUri: string;
  }) => Promise<{ config: ContactGoogleSyncConfigClient }>;
};

export function useGoogleContactsOAuth({
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
}: {
  canWrite: boolean;
  config: ContactGoogleSyncConfigClient;
  setConfig: Dispatch<SetStateAction<ContactGoogleSyncConfigClient>>;
  isConfigured: boolean;
  configLoading: boolean;
  exchangeOAuth: ExchangeOAuthMutation;
  setError: Dispatch<SetStateAction<string>>;
  setShowAuthCode: Dispatch<SetStateAction<boolean>>;
  setAuthCode: Dispatch<SetStateAction<string>>;
  setExchanging: Dispatch<SetStateAction<boolean>>;
  t: TranslationFunction;
}) {
  const exchangeOAuthCode = useCallback(
    async (code: string): Promise<void> => {
      if (!canWrite || !code.trim() || !isConfigured) return;
      setExchanging(true);
      setError("");
      try {
        const redirectUri = `${window.location.origin}/contacts`;
        const { config: exchangedConfig } = await exchangeOAuth.mutateAsync({
          code: code.trim(),
          redirectUri,
        });
        setConfig((prev) => ({
          ...prev,
          clientId: exchangedConfig.clientId ?? prev.clientId,
        }));
        setShowAuthCode(false);
        setAuthCode("");
        setError("");
      } catch {
        setError(t("contacts.sync.oauthError"));
      } finally {
        setExchanging(false);
      }
    },
    [
      canWrite,
      exchangeOAuth,
      isConfigured,
      setAuthCode,
      setConfig,
      setError,
      setExchanging,
      setShowAuthCode,
      t,
    ],
  );

  const handleConnect = (): void => {
    if (!canWrite || !config.clientId) return;
    const redirectUri = window.location.origin + "/contacts";
    const scope = encodeURIComponent("https://www.googleapis.com/auth/contacts.readonly");
    const state = encodeURIComponent(JSON.stringify({ source: "google_contacts" }));
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${config.clientId}&redirect_uri=${encodeURIComponent(
      redirectUri,
    )}&response_type=code&scope=${scope}&access_type=offline&state=${state}&prompt=consent`;
    window.open(url, "_blank", "width=500,height=600");
    setError(t("contacts.sync.oauthRedirectHint"));
    setShowAuthCode(true);
  };

  const handleExchangeCode = async (authCode: string): Promise<void> => {
    await exchangeOAuthCode(authCode);
  };

  useEffect(() => {
    const onMessage = (event: MessageEvent): void => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== GOOGLE_CONTACTS_OAUTH_MESSAGE || typeof event.data.code !== "string")
        return;
      setAuthCode(event.data.code);
      setShowAuthCode(true);
      void exchangeOAuthCode(event.data.code);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [exchangeOAuthCode, setAuthCode, setShowAuthCode]);

  useEffect(() => {
    if (!canWrite || configLoading || !isConfigured) return;
    const pending = takeGoogleContactsOAuthCode();
    if (!pending) return;
    setAuthCode(pending);
    setShowAuthCode(true);
    void exchangeOAuthCode(pending);
  }, [canWrite, configLoading, isConfigured, exchangeOAuthCode, setAuthCode, setShowAuthCode]);

  return {
    handleConnect,
    handleExchangeCode,
  };
}
