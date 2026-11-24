import { useState } from "react";

/**
 * Re-seeds local form state when the form's identity changes.
 *
 * The identity is normally `${open ? "open" : "closed"}:${recordId ?? "new"}`.
 * The reset runs during render (React's "adjust state when props change"
 * pattern, already used by the examination/invoice/task forms) instead of in an
 * effect, so the first paint after a record switch never shows the previous
 * record's values.
 *
 * `reset` must only update state owned by the calling component. It runs once
 * per identity change and once when the identity changes back (e.g. closing the
 * dialog), which cleanly clears drafts without an effect.
 */
export function useIdentityReset(identity: string, reset: () => void): void {
  // `null` guarantees one reset on mount: a form opened directly on an existing
  // record must hydrate on its first render, not only after a later switch.
  const [currentIdentity, setCurrentIdentity] = useState<string | null>(null);
  if (currentIdentity !== identity) {
    setCurrentIdentity(identity);
    reset();
  }
}
