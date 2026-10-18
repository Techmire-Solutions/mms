import { isOriginAllowedForAppDomain, isTrustedWorkspaceOrigin } from "@mms/shared";
import { fetchWithTimeout } from "../../lib/outboundUrl.js";
import {
  clearGoogleSyncTokens,
  getContactGoogleSyncConfig,
  GoogleOAuthExchangeError,
  GoogleSyncError,
  redactGoogleSyncConfigForClient,
  setContactGoogleSyncConfig,
  type ContactGoogleSyncConfigClient,
} from "./contactGoogleSyncConfig.js";

interface GoogleTokenResponse {
  access_token?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

/** Path must be Contacts Work; host must match apex/tenant allowlist (not path-only). */
function isAllowedOAuthRedirectUri(redirectUri: string): boolean {
  try {
    const url = new URL(redirectUri);
    const pathOk = url.pathname === "/contacts" || url.pathname.endsWith("/contacts");
    if (!pathOk) return false;

    const origin = url.origin;
    const appDomain = process.env.MMS_APP_DOMAIN?.trim();
    if (appDomain) {
      return isOriginAllowedForAppDomain(origin, appDomain);
    }
    return isTrustedWorkspaceOrigin(origin);
  } catch {
    return false;
  }
}

async function requestGoogleToken(params: URLSearchParams): Promise<GoogleTokenResponse> {
  const res = await fetchWithTimeout("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: params,
  });
  return (await res.json()) as GoogleTokenResponse;
}

export async function refreshGoogleAccessToken(userId: string): Promise<string> {
  const config = await getContactGoogleSyncConfig(userId);
  if (!config.refreshToken || !config.clientId || !config.clientSecret) {
    await clearGoogleSyncTokens(userId);
    throw new GoogleSyncError("Google session expired", "session_expired");
  }

  const params = new URLSearchParams({
    refresh_token: config.refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "refresh_token",
  });

  const tokenResponse = await requestGoogleToken(params);
  if (tokenResponse.error || !tokenResponse.access_token) {
    await clearGoogleSyncTokens(userId);
    throw new GoogleSyncError(
      tokenResponse.error_description || tokenResponse.error || "Google session expired",
      "session_expired",
    );
  }

  await setContactGoogleSyncConfig(userId, {
    ...config,
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token ?? config.refreshToken,
  });

  return tokenResponse.access_token;
}

/** Exchange authorization code server-side so client secret never leaves the backend. */
export async function exchangeGoogleContactsOAuthCode(
  userId: string,
  code: string,
  redirectUri: string,
): Promise<ContactGoogleSyncConfigClient> {
  if (!isAllowedOAuthRedirectUri(redirectUri)) {
    throw new GoogleOAuthExchangeError("Invalid redirect URI");
  }

  const existing = await getContactGoogleSyncConfig(userId);
  if (!existing.clientId || !existing.clientSecret) {
    throw new GoogleOAuthExchangeError("Google OAuth credentials are not configured");
  }

  const params = new URLSearchParams({
    code,
    client_id: existing.clientId,
    client_secret: existing.clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const tokenResponse = await requestGoogleToken(params);

  if (tokenResponse.error) {
    throw new GoogleOAuthExchangeError(
      tokenResponse.error_description || tokenResponse.error,
      tokenResponse.error,
    );
  }
  if (!tokenResponse.access_token) {
    throw new GoogleOAuthExchangeError("No access token returned from Google");
  }

  const saved = await setContactGoogleSyncConfig(userId, {
    ...existing,
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token ?? existing.refreshToken,
  });

  return redactGoogleSyncConfigForClient(saved);
}
