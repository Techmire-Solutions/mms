import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearGoogleContactsOAuthUrlParams,
  createGoogleContactsOAuthRequest,
  createGoogleContactsOAuthState,
  readGoogleContactsOAuthCodeFromUrl,
  relayGoogleContactsOAuthPopup,
  shouldOpenContactsSyncSetup,
  stashGoogleContactsOAuthCode,
  takeGoogleContactsOAuthCode,
  takeGoogleContactsOAuthVerifier,
} from "@/lib/contacts/googleContactsOAuth";

const LEGACY_STATE = encodeURIComponent(JSON.stringify({ source: "google_contacts" }));

function setUrl(search: string): void {
  window.history.replaceState({}, "", `${window.location.pathname}${search}`);
}

/** Encodes the state the connect handler would have produced for `nonce`. */
function stateWithNonce(nonce: string): string {
  return encodeURIComponent(JSON.stringify({ source: "google_contacts", nonce }));
}

/** Stores the nonce the callback is expected to echo. */
function storeNonce(nonce: string, createdAt = Date.now()): void {
  sessionStorage.setItem("mms_google_google_oauth_state", JSON.stringify({ nonce, createdAt }));
}

describe("readGoogleContactsOAuthCodeFromUrl", () => {
  beforeEach(() => {
    setUrl("");
    sessionStorage.clear();
  });

  it("returns the code when the returned nonce matches the stored one", () => {
    storeNonce("nonce-1");
    setUrl(`?code=abc123&state=${stateWithNonce("nonce-1")}`);
    expect(readGoogleContactsOAuthCodeFromUrl()).toBe("abc123");
  });

  it("consumes the nonce so a replayed callback is rejected", () => {
    storeNonce("nonce-1");
    setUrl(`?code=abc123&state=${stateWithNonce("nonce-1")}`);
    expect(readGoogleContactsOAuthCodeFromUrl()).toBe("abc123");
    setUrl(`?code=abc123&state=${stateWithNonce("nonce-1")}`);
    expect(readGoogleContactsOAuthCodeFromUrl()).toBeNull();
  });

  it("rejects a crafted state without the stored nonce", () => {
    storeNonce("victim-nonce");
    setUrl(`?code=attacker-code&state=${stateWithNonce("attacker-nonce")}`);
    expect(readGoogleContactsOAuthCodeFromUrl()).toBeNull();
  });

  it("rejects the legacy constant state (no nonce)", () => {
    setUrl(`?code=abc123&state=${LEGACY_STATE}`);
    expect(readGoogleContactsOAuthCodeFromUrl()).toBeNull();
  });

  it("rejects an expired nonce", () => {
    storeNonce("nonce-1", Date.now() - 11 * 60 * 1000);
    setUrl(`?code=abc123&state=${stateWithNonce("nonce-1")}`);
    expect(readGoogleContactsOAuthCodeFromUrl()).toBeNull();
  });

  it("returns null when the code is missing", () => {
    storeNonce("nonce-1");
    setUrl(`?state=${stateWithNonce("nonce-1")}`);
    expect(readGoogleContactsOAuthCodeFromUrl()).toBeNull();
  });

  it("returns null for missing or foreign state", () => {
    storeNonce("nonce-1");
    setUrl("?code=abc123");
    expect(readGoogleContactsOAuthCodeFromUrl()).toBeNull();
    setUrl(`?code=abc123&state=${encodeURIComponent(JSON.stringify({ source: "other" }))}`);
    expect(readGoogleContactsOAuthCodeFromUrl()).toBeNull();
  });
});

describe("createGoogleContactsOAuthState", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("embeds a fresh nonce and stores it for the callback", () => {
    const state = JSON.parse(decodeURIComponent(createGoogleContactsOAuthState())) as {
      source?: string;
      nonce?: string;
    };
    expect(state.source).toBe("google_contacts");
    expect(typeof state.nonce).toBe("string");
    const stored = JSON.parse(sessionStorage.getItem("mms_google_google_oauth_state") ?? "{}") as {
      nonce?: string;
    };
    expect(stored.nonce).toBe(state.nonce);
  });
});

describe("createGoogleContactsOAuthRequest (PKCE)", () => {
  beforeEach(() => {
    setUrl("");
    sessionStorage.clear();
  });

  async function expectedChallenge(verifier: string): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    let binary = "";
    for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  it("stores a one-shot verifier and returns its S256 challenge", async () => {
    const { state, codeChallenge } = await createGoogleContactsOAuthRequest();
    const parsed = JSON.parse(decodeURIComponent(state)) as {
      source?: string;
      nonce?: string;
    };
    expect(parsed.source).toBe("google_contacts");
    expect(typeof parsed.nonce).toBe("string");

    const verifier = takeGoogleContactsOAuthVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(codeChallenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(codeChallenge).toBe(await expectedChallenge(verifier ?? ""));
    expect(takeGoogleContactsOAuthVerifier()).toBeNull();
  });

  it("keeps the verifier after the callback consumes the nonce", async () => {
    const { state } = await createGoogleContactsOAuthRequest();
    setUrl(`?code=abc123&state=${state}`);
    expect(readGoogleContactsOAuthCodeFromUrl()).toBe("abc123");
    expect(takeGoogleContactsOAuthVerifier()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

describe("clearGoogleContactsOAuthUrlParams", () => {
  beforeEach(() => {
    setUrl("");
  });

  it("strips the OAuth params via history.replaceState", () => {
    setUrl("?code=abc&state=xyz&scope=email&authuser=0&prompt=consent&keep=1");
    const replaceSpy = vi.spyOn(window.history, "replaceState");
    clearGoogleContactsOAuthUrlParams();
    expect(replaceSpy).toHaveBeenCalled();
    expect(window.location.search).toBe("?keep=1");
    replaceSpy.mockRestore();
  });

  it("is a no-op when no OAuth params are present", () => {
    setUrl("?keep=1");
    const replaceSpy = vi.spyOn(window.history, "replaceState");
    clearGoogleContactsOAuthUrlParams();
    expect(replaceSpy).not.toHaveBeenCalled();
    replaceSpy.mockRestore();
  });
});

describe("stash/take/shouldOpen", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("stashes the code and flags the setup panel", () => {
    stashGoogleContactsOAuthCode("code-42");
    expect(takeGoogleContactsOAuthCode()).toBe("code-42");
    expect(takeGoogleContactsOAuthCode()).toBeNull();
    expect(shouldOpenContactsSyncSetup()).toBe(true);
    expect(shouldOpenContactsSyncSetup()).toBe(false);
  });
});

describe("relayGoogleContactsOAuthPopup", () => {
  afterEach(() => {
    window.opener = null;
  });

  it("relays the code to the opener and closes the window", () => {
    const postMessage = vi.fn();
    const close = vi.fn();
    const opener = { closed: false, postMessage } as unknown as Window;
    window.opener = opener;
    vi.spyOn(window, "close").mockImplementation(close);

    expect(relayGoogleContactsOAuthPopup("code-7")).toBe(true);
    expect(postMessage).toHaveBeenCalledWith(
      { type: "mms-google-contacts-oauth", code: "code-7" },
      window.location.origin,
    );
    expect(close).toHaveBeenCalled();
  });

  it("returns false when the opener is closed", () => {
    window.opener = { closed: true, postMessage: vi.fn() } as unknown as Window;
    expect(relayGoogleContactsOAuthPopup("code-7")).toBe(false);
  });
});
