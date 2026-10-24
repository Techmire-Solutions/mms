import { useEffect } from "react";
import {
  clearGoogleContactsOAuthUrlParams,
  readGoogleContactsOAuthCodeFromUrl,
  relayGoogleContactsOAuthPopup,
  stashGoogleContactsOAuthCode,
  GOOGLE_CONTACTS_OAUTH_MESSAGE,
} from "./googleContactsOAuth";

/**
 * Custom hook to handle incoming Google Contacts OAuth callbacks
 * via window postMessage and URL redirect parameters.
 */
export function useGoogleContactsOAuthListener(onCodeReceived?: (code: string) => void): void {
  useEffect(() => {
    const code = readGoogleContactsOAuthCodeFromUrl();
    if (code) {
      clearGoogleContactsOAuthUrlParams();
      if (!relayGoogleContactsOAuthPopup(code)) {
        stashGoogleContactsOAuthCode(code);
        onCodeReceived?.(code);
      }
    }

    const handleOAuthMessage = (event: MessageEvent): void => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== GOOGLE_CONTACTS_OAUTH_MESSAGE || typeof event.data.code !== "string")
        return;
      stashGoogleContactsOAuthCode(event.data.code);
      onCodeReceived?.(event.data.code);
    };

    window.addEventListener("message", handleOAuthMessage);
    return () => window.removeEventListener("message", handleOAuthMessage);
  }, [onCodeReceived]);
}
