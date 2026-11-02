export const GOOGLE_CONTACTS_OAUTH_MESSAGE = "mms-google-contacts-oauth" as const;
const GOOGLE_CONTACTS_OAUTH_PENDING_KEY = "mms_pending_google_oauth_code";
const GOOGLE_CONTACTS_OPEN_SYNC_SETUP_KEY = "mms_open_contacts_sync_setup";
const GOOGLE_CONTACTS_OAUTH_STATE_KEY = "mms_google_google_oauth_state";
const GOOGLE_CONTACTS_OAUTH_VERIFIER_KEY = "mms_google_google_oauth_verifier";
/** A stale authorization code is useless after this window; also bounds replay. */
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

interface StoredOAuthState {
  nonce: string;
  createdAt: number;
}

interface StoredOAuthVerifier {
  verifier: string;
  createdAt: number;
}

interface ParsedOAuthState {
  source?: string;
  nonce?: string;
}

function parseOAuthState(stateRaw: string | null): ParsedOAuthState | null {
  if (!stateRaw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(stateRaw)) as ParsedOAuthState;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Builds the OAuth `state` for a new connect attempt. A per-attempt nonce is
 * stored in `sessionStorage`; the callback only accepts a code whose echoed
 * nonce matches it. A crafted `?code=…&state=…` link therefore cannot bind an
 * attacker's Google account to the victim's session, because the attacker
 * cannot know the victim's nonce.
 */
export function createGoogleContactsOAuthState(): string {
  const nonce =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    sessionStorage.setItem(
      GOOGLE_CONTACTS_OAUTH_STATE_KEY,
      JSON.stringify({ nonce, createdAt: Date.now() } satisfies StoredOAuthState),
    );
  } catch {
    // Private-mode / disabled storage: the callback will simply be rejected.
  }
  return encodeURIComponent(JSON.stringify({ source: "google_contacts", nonce }));
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** RFC 7636 verifier: 32 random bytes → 43 base64url characters. */
function randomCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function computeCodeChallenge(verifier: string): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("Web Crypto is required for Google Contacts OAuth PKCE");
  }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64UrlEncode(new Uint8Array(digest));
}

/**
 * Builds the OAuth `state` plus an S256 PKCE pair for a new connect attempt.
 *
 * The verifier stays in `sessionStorage` (never in the URL); only its SHA-256
 * challenge goes to Google. An intercepted authorization code is therefore
 * useless without the verifier, and the existing nonce still blocks a crafted
 * `?code=…&state=…` callback (C-11).
 */
export async function createGoogleContactsOAuthRequest(): Promise<{
  state: string;
  codeChallenge: string;
}> {
  const state = createGoogleContactsOAuthState();
  const verifier = randomCodeVerifier();
  const codeChallenge = await computeCodeChallenge(verifier);
  try {
    sessionStorage.setItem(
      GOOGLE_CONTACTS_OAUTH_VERIFIER_KEY,
      JSON.stringify({ verifier, createdAt: Date.now() } satisfies StoredOAuthVerifier),
    );
  } catch {
    // Private-mode / disabled storage: exchange proceeds without a verifier and
    // Google rejects the code when a challenge was sent (fail closed).
  }
  return { state, codeChallenge };
}

/** Reads and clears the PKCE verifier — one exchange per connect attempt. */
export function takeGoogleContactsOAuthVerifier(): string | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(GOOGLE_CONTACTS_OAUTH_VERIFIER_KEY);
    sessionStorage.removeItem(GOOGLE_CONTACTS_OAUTH_VERIFIER_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as Partial<StoredOAuthVerifier>;
    if (typeof stored.verifier !== "string" || typeof stored.createdAt !== "number") return null;
    if (Date.now() - stored.createdAt > OAUTH_STATE_TTL_MS) return null;
    return stored.verifier;
  } catch {
    return null;
  }
}

/** Reads and clears the stored nonce — one authorization code per attempt. */
function consumeStoredOAuthNonce(): string | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(GOOGLE_CONTACTS_OAUTH_STATE_KEY);
    sessionStorage.removeItem(GOOGLE_CONTACTS_OAUTH_STATE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as Partial<StoredOAuthState>;
    if (typeof stored.nonce !== "string" || typeof stored.createdAt !== "number") return null;
    if (Date.now() - stored.createdAt > OAUTH_STATE_TTL_MS) return null;
    return stored.nonce;
  } catch {
    return null;
  }
}

/**
 * Read OAuth `code` from the current URL when returning from Google (Contacts
 * redirect URI). Requires a matching, unexpired `state` nonce.
 */
export function readGoogleContactsOAuthCodeFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = parseOAuthState(params.get("state"));
  // Only a real callback consumes the pending nonce: an unrelated navigation to
  // /contacts must not clear an in-flight connect attempt.
  if (!code || !state || state.source !== "google_contacts") return null;
  const expectedNonce = consumeStoredOAuthNonce();
  if (!expectedNonce || state.nonce !== expectedNonce) return null;
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
