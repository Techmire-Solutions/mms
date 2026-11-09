import { and, eq, isNull } from "drizzle-orm";
import { attendanceAbsenceAlerts } from "../schema.js";
import { withTenant } from "../tenant-context.js";

/**
 * Notification claims for chronic-absence alerts.
 *
 * Split from the escalation repository for the 300-line band. A claim is an atomic
 * `UPDATE … WHERE notified_at IS NULL`, which is what makes two concurrent scans (the hourly sweep and
 * a manual job) send one notification rather than two.
 */

/**
 * Atomically claims the right to notify for this alert.
 *
 * `UPDATE … WHERE notified_at IS NULL RETURNING id` is the lock: of two concurrent scans (manual job
 * + hourly sweep) only one updates a row, so only one sends the notification. A crash after the claim
 * cannot duplicate either — the notification carries its own `absence-alert:<id>` dedupe key.
 */
export async function claimAbsenceAlertNotification(tenant: string, id: string): Promise<boolean> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const claimed = await tx
      .update(attendanceAbsenceAlerts)
      .set({ notifiedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(attendanceAbsenceAlerts.workspaceSubdomain, subdomain),
          eq(attendanceAbsenceAlerts.id, id),
          isNull(attendanceAbsenceAlerts.notifiedAt),
        ),
      )
      .returning({ id: attendanceAbsenceAlerts.id });
    return claimed.length > 0;
  });
}

/** Releases a claim whose notification could not be stored, so the next scan retries it. */
export async function releaseAbsenceAlertNotification(tenant: string, id: string): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, (tx) =>
    tx
      .update(attendanceAbsenceAlerts)
      .set({ notifiedAt: null, updatedAt: new Date() })
      .where(
        and(
          eq(attendanceAbsenceAlerts.workspaceSubdomain, subdomain),
          eq(attendanceAbsenceAlerts.id, id),
        ),
      ),
  );
}
