import { sql } from "drizzle-orm";
import { SEAT_AVAILABLE_REVIEW_NOTE } from "@mms/shared";
import { withTenant } from "../tenant-context.js";

/**
 * Moves the oldest waitlisted application for the class back to `under_review` with a
 * seat-available note. Returns it, or null when nobody is waiting. `SKIP LOCKED` keeps two seat
 * releases from flagging the same application.
 */
export async function flagOldestWaitlistedApplication(
  tenant: string,
  classId: string,
): Promise<{ id: string; reference: string } | null> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const result = await tx.execute<{ id: string; reference: string }>(sql`
      UPDATE registration_applications
         SET status = 'under_review', review_reason = ${SEAT_AVAILABLE_REVIEW_NOTE}, updated_at = now()
       WHERE workspace_subdomain = ${subdomain}
         AND id = (
           SELECT id FROM registration_applications
            WHERE workspace_subdomain = ${subdomain} AND class_id = ${classId}
              AND status = 'waitlisted' AND deleted_at IS NULL
            ORDER BY created_at, id
            LIMIT 1
            FOR UPDATE SKIP LOCKED
         )
      RETURNING id, reference`);
    return result.rows[0] ?? null;
  });
}
