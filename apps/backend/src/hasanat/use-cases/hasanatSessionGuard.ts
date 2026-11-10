/**
 * Closed-session write guard for Hasanat.
 *
 * Cards are session-scoped evidence: once the session is `completed`, `cancelled` or `archived`,
 * points must not move any more. The sanctioned override is reopening the session through the
 * session lifecycle — this module deliberately exposes no second lock.
 */

import { cardWriteBlockedBySessionStatus, cardWriteBlockedMessage } from "@mms/shared";
import { ConflictError } from "../../lib/httpErrors.js";
import { findSessionStatuses } from "../repository/hasanatRepositoryAdapter.js";

/** Throws 409 when the session is read-only; missing/unknown sessions are allowed through. */
export async function assertSessionWritable(
  tenant: string,
  sessionId: string | null | undefined,
): Promise<void> {
  if (!sessionId) return;
  const statuses = await findSessionStatuses(tenant, [sessionId]);
  const status = statuses.get(sessionId) ?? null;
  if (status && cardWriteBlockedBySessionStatus(status)) {
    throw new ConflictError(cardWriteBlockedMessage(status));
  }
}

/** Same check for a group: one query, first blocked session fails the whole write. */
export async function assertSessionsWritable(
  tenant: string,
  sessionIds: readonly string[],
): Promise<void> {
  const ids = Array.from(new Set(sessionIds.filter(Boolean)));
  if (ids.length === 0) return;
  const statuses = await findSessionStatuses(tenant, ids);
  for (const id of ids) {
    const status = statuses.get(id) ?? null;
    if (status && cardWriteBlockedBySessionStatus(status)) {
      throw new ConflictError(cardWriteBlockedMessage(status));
    }
  }
}
