import { and, eq, inArray } from "drizzle-orm";
import { WEEKDAY_NAMES, weekdayIndexes, type WeekdayName } from "@mms/shared";
import { sessionWorkingDays } from "../schema.js";
import type { TenantTransaction } from "../tenant-context.js";

/** Replaces a session's weekly teaching days; `undefined` leaves them untouched, `[]` clears the override. */
export async function replaceSessionWorkingDaysTx(
  tx: TenantTransaction,
  subdomain: string,
  sessionId: string,
  days: readonly string[] | undefined,
): Promise<void> {
  if (days === undefined) return;
  await tx
    .delete(sessionWorkingDays)
    .where(
      and(
        eq(sessionWorkingDays.workspaceSubdomain, subdomain),
        eq(sessionWorkingDays.sessionId, sessionId),
      ),
    );
  const weekdays = weekdayIndexes(days);
  if (weekdays.length === 0) return;
  await tx
    .insert(sessionWorkingDays)
    .values(weekdays.map((weekday) => ({ workspaceSubdomain: subdomain, sessionId, weekday })));
}

/** Session id → teaching-day names (sessions without an override are absent). */
export async function loadSessionWorkingDaysTx(
  tx: TenantTransaction,
  subdomain: string,
  sessionIds: readonly string[],
): Promise<Map<string, WeekdayName[]>> {
  const result = new Map<string, WeekdayName[]>();
  if (sessionIds.length === 0) return result;
  const rows = await tx
    .select({ sessionId: sessionWorkingDays.sessionId, weekday: sessionWorkingDays.weekday })
    .from(sessionWorkingDays)
    .where(
      and(
        eq(sessionWorkingDays.workspaceSubdomain, subdomain),
        inArray(sessionWorkingDays.sessionId, [...sessionIds]),
      ),
    );
  for (const row of [...rows].sort((a, b) => a.weekday - b.weekday)) {
    const name = WEEKDAY_NAMES[row.weekday];
    if (!name) continue;
    result.set(row.sessionId, [...(result.get(row.sessionId) ?? []), name]);
  }
  return result;
}

/** Hydrates `workingDays` (absent override → empty list = workspace default). */
export async function attachSessionWorkingDaysTx<
  T extends { id: string; workingDays?: WeekdayName[] },
>(tx: TenantTransaction, subdomain: string, sessions: T[]): Promise<T[]> {
  const byId = await loadSessionWorkingDaysTx(
    tx,
    subdomain,
    sessions.map((session) => String(session.id)),
  );
  return sessions.map((session) => ({
    ...session,
    workingDays: byId.get(String(session.id)) ?? [],
  }));
}
