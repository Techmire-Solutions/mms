import { useState } from "react";
import { usePlatformAuth } from "@/platform/lib/PlatformAuthContext";
import {
  readPlatformNotificationAcks,
  writePlatformNotificationAcks,
} from "@/platform/lib/platformNotificationAckStorage";

interface UsePlatformNotificationAckResult {
  ackedIds: Set<string>;
  ackAll: (ids: string[]) => void;
}

/**
 * Persists acknowledged platform notification IDs to localStorage to clear the
 * red dot. The key is scoped per platform admin (`_u:<userId>`), so one
 * operator's acks never suppress another operator's unread badges on a shared
 * device; without a signed-in user the set stays in memory only.
 */
export function usePlatformNotificationAck(): UsePlatformNotificationAckResult {
  const { platformUser } = usePlatformAuth();
  const userId = platformUser?.id ?? null;

  const [state, setState] = useState<{ userId: string | null; ids: Set<string> }>(() => ({
    userId,
    ids: readPlatformNotificationAcks(userId),
  }));

  // Re-hydrate when the signed-in admin changes (logout/login or account
  // switch). Reset during render — never from an effect.
  const [prevUserId, setPrevUserId] = useState(userId);
  if (prevUserId !== userId) {
    setPrevUserId(userId);
    setState({ userId, ids: readPlatformNotificationAcks(userId) });
  }

  const ackedIds = state.userId === userId ? state.ids : readPlatformNotificationAcks(userId);

  const ackAll = (ids: string[]) => {
    setState((prev) => {
      const next = new Set(prev.ids);
      for (const id of ids) next.add(id);
      writePlatformNotificationAcks(prev.userId, next);
      return { userId: prev.userId, ids: next };
    });
  };

  return { ackedIds, ackAll };
}
