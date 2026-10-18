export const GOOGLE_CONTACTS_OAUTH_MESSAGE = "mms-google-contacts-oauth" as const;
const GOOGLE_CONTACTS_OAUTH_PENDING_KEY = "mms_pending_google_oauth_code";
const GOOGLE_CONTACTS_OPEN_SYNC_SETUP_KEY = "mms_open_contacts_sync_setup";

function parseGoogleContactsOAuthState(stateRaw: string | null): boolean {
  if (!stateRaw) return false;
  try {
    const state = JSON.parse(decodeURIComponent(stateRaw)) as { source?: string };
    return state.source === "google_contacts";
  } catch {
    return false;
  }
}

/** Read OAuth `code` from the current URL when returning from Google (Contacts redirect URI). */
export function readGoogleContactsOAuthCodeFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  if (!code || !parseGoogleContactsOAuthState(params.get("state"))) return null;
  return code;
}

/** Strip OAuth query params from the address bar without reloading. */
export function clearGoogleContactsOAuthUrlParams(): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  if (!params.has("code") && !params.has("state")) return;
  params.delete("code");
  params.delete("state");
  params.delete("scope");
  params.delete("authuser");
  params.delete("prompt");
  const queryString = params.toString();
  const cleanedUrl = queryString
    ? `${window.location.pathname}?${queryString}`
    : window.location.pathname;
  window.history.replaceState({}, "", cleanedUrl);
}

export function stashGoogleContactsOAuthCode(code: string): void {
  sessionStorage.setItem(GOOGLE_CONTACTS_OAUTH_PENDING_KEY, code);
  sessionStorage.setItem(GOOGLE_CONTACTS_OPEN_SYNC_SETUP_KEY, "1");
}

export function takeGoogleContactsOAuthCode(): string | null {
  const code = sessionStorage.getItem(GOOGLE_CONTACTS_OAUTH_PENDING_KEY);
  if (code) sessionStorage.removeItem(GOOGLE_CONTACTS_OAUTH_PENDING_KEY);
  return code;
}

export function shouldOpenContactsSyncSetup(): boolean {
  const open = sessionStorage.getItem(GOOGLE_CONTACTS_OPEN_SYNC_SETUP_KEY) === "1";
  if (open) sessionStorage.removeItem(GOOGLE_CONTACTS_OPEN_SYNC_SETUP_KEY);
  return open;
}

/** Popup callback: relay code to opener and close. Returns true when handled as popup. */
export function relayGoogleContactsOAuthPopup(code: string): boolean {
  if (typeof window === "undefined" || !window.opener || window.opener.closed) return false;
  window.opener.postMessage({ type: GOOGLE_CONTACTS_OAUTH_MESSAGE, code }, window.location.origin);
  window.close();
  return true;
}
