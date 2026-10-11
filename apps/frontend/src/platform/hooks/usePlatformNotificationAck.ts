import { useState } from "react";

const STORAGE_KEY = "mms_platform_notif_ack";

function readAckedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return new Set(parsed as string[]);
  } catch {
    // ignore
  }
  return new Set();
}

function writeAckedIds(ids: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore quota/private mode
  }
}

interface UsePlatformNotificationAckResult {
  ackedIds: Set<string>;
  ackAll: (ids: string[]) => void;
}

/** Persists acknowledged platform notification IDs in localStorage to clear the red dot. */
export function usePlatformNotificationAck(): UsePlatformNotificationAckResult {
  const [ackedIds, setAckedIds] = useState<Set<string>>(() => readAckedIds());

  const ackAll = (ids: string[]) => {
    setAckedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      writeAckedIds(next);
      return next;
    });
  };

  return { ackedIds, ackAll };
}
