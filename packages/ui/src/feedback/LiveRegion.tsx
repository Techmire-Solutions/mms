import React, { createContext, useContext, useState, useCallback, useMemo } from "react";

export interface LiveAnnouncerContextValue {
  announcePolite: (message: string) => void;
  announceAssertive: (message: string) => void;
}

const LiveAnnouncerContext = createContext<LiveAnnouncerContextValue>({
  announcePolite: () => {},
  announceAssertive: () => {},
});

export function useLiveAnnouncer(): LiveAnnouncerContextValue {
  return useContext(LiveAnnouncerContext);
}

export interface LiveRegionProviderProps {
  children: React.ReactNode;
}

/**
 * WCAG 2.2 Dual ARIA Live Region Provider.
 * Broadcasts asynchronous background updates (polite) and critical telemetry/service outages (assertive).
 */
export function LiveRegionProvider({ children }: LiveRegionProviderProps): React.JSX.Element {
  const [politeMessage, setPoliteMessage] = useState("");
  const [assertiveMessage, setAssertiveMessage] = useState("");

  const announcePolite = useCallback((message: string) => {
    setPoliteMessage("");
    // Trigger DOM update on next tick
    window.setTimeout(() => setPoliteMessage(message), 50);
  }, []);

  const announceAssertive = useCallback((message: string) => {
    setAssertiveMessage("");
    window.setTimeout(() => setAssertiveMessage(message), 50);
  }, []);

  const value = useMemo(
    () => ({ announcePolite, announceAssertive }),
    [announcePolite, announceAssertive],
  );

  return (
    <LiveAnnouncerContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="live-region-polite"
      >
        {politeMessage}
      </div>
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
        data-testid="live-region-assertive"
      >
        {assertiveMessage}
      </div>
    </LiveAnnouncerContext.Provider>
  );
}
