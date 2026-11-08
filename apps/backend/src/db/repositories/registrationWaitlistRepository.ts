import { sql } from "drizzle-orm";
import { SEAT_AVAILABLE_REVIEW_NOTE, SEAT_RELEASED_ENROLLMENT_STATUSES } from "@mms/shared";
import { withTenant, withGlobalTenant } from "../tenant-context.js";

/** The application a freed seat flagged, with the labels a staff notification needs. */
export type FlaggedWaitlistApplication = {
  id: string;
  reference: string;
  fullName: string;
  className: string;
  expiresAt: string | null;
};

/**
 * Moves the oldest waitlisted application for the class back to `under_review` with a
 * seat-available note. Returns it, or null when nobody is waiting. `SKIP LOCKED` keeps two seat
 * releases from flagging the same application.
 */
export async function flagOldestWaitlistedApplication(
  tenant: string,
  classId: string,
  offerHours = 72,
): Promise<FlaggedWaitlistApplication | null> {
  const subdomain = tenant.trim().toLowerCase();
  const hours = Math.min(720, Math.max(1, Math.trunc(offerHours)));
  return withTenant(subdomain, async (tx) => {
    const result = await tx.execute<FlaggedWaitlistApplication>(sql`
      UPDATE registration_applications
         SET status = 'under_review', review_reason = ${SEAT_AVAILABLE_REVIEW_NOTE},
             waitlist_offered_at = now(),
             waitlist_offer_expires_at = now() + make_interval(hours => ${hours}),
             updated_at = now()
       WHERE workspace_subdomain = ${subdomain}
         AND id = (
           SELECT id FROM registration_applications
            WHERE workspace_subdomain = ${subdomain} AND class_id = ${classId}
              AND status = 'waitlisted' AND deleted_at IS NULL
            ORDER BY created_at, id
            LIMIT 1
            FOR UPDATE SKIP LOCKED
         )
      RETURNING id, reference, full_name AS "fullName",
        to_char(waitlist_offer_expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "expiresAt",
        coalesce((SELECT sc.name FROM session_classes sc
                   WHERE sc.workspace_subdomain = registration_applications.workspace_subdomain
                     AND sc.id = registration_applications.class_id), '') AS "className"`);
    return result.rows[0] ?? null;
  });
}

export interface RevertedWaitlistOffer {
  workspace: string;
  id: string;
}

const CLEAR_OFFER = sql`
  status = 'waitlisted',
  review_reason = NULL,
  waitlist_offered_at = NULL,
  waitlist_offer_expires_at = NULL,
  updated_at = now()`;

/**
 * Reverts every offer whose window lapsed (`under_review` + expired). Leader-only sweep:
 * selects the due rows with `SKIP LOCKED` first (a `FOR UPDATE` subquery inside an UPDATE is
 * not portable), then clears them in the same transaction, so concurrent sweeps are safe.
 */
export async function revertExpiredWaitlistOffers(limit = 200): Promise<RevertedWaitlistOffer[]> {
  return withGlobalTenant(async (tx) => {
    const selected = await tx.execute<{ workspace: string; id: string }>(sql`
      SELECT workspace_subdomain AS workspace, id
        FROM registration_applications
       WHERE status = 'under_review'
         AND waitlist_offer_expires_at IS NOT NULL
         AND waitlist_offer_expires_at <= now()
         AND deleted_at IS NULL
       ORDER BY waitlist_offer_expires_at
       LIMIT ${limit}
       FOR UPDATE SKIP LOCKED
    `);
    const rows = selected.rows;
    if (rows.length === 0) return [];
    const keys = sql.join(
      rows.map((row) => sql`(${row.workspace}, ${row.id})`),
      sql`, `,
    );
    await tx.execute(sql`
      UPDATE registration_applications
         SET ${CLEAR_OFFER}
       WHERE (workspace_subdomain, id) IN (${keys})
    `);
    return rows;
  });
}

/** Reverts unconsumed seat offers for a class (the seat was taken before staff approved). */
export async function revertSeatOffersForClass(tenant: string, classId: string): Promise<string[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const result = await tx.execute<{ id: string }>(sql`
      UPDATE registration_applications
         SET ${CLEAR_OFFER}
       WHERE workspace_subdomain = ${subdomain}
         AND class_id = ${classId}
         AND status = 'under_review'
         AND waitlist_offer_expires_at IS NOT NULL
         AND deleted_at IS NULL
      RETURNING id
    `);
    return result.rows.map((row) => row.id);
  });
}

/**
 * True when the class still has a seat (or capacity 0 = unlimited). Section capacities win when
 * the class has sections; otherwise the class-level `max_students` applies.
 */
export async function classHasFreeSeat(tenant: string, classId: string): Promise<boolean> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const result = await tx.execute<{
      used: number;
      sectionCount: number;
      sectionCapacity: number;
      unlimitedSection: boolean;
      classCapacity: number;
    }>(sql`
      SELECT
        (SELECT count(*)::int FROM enrollments e
          WHERE e.workspace_subdomain = ${subdomain} AND e.class_id = ${classId}
            AND e.deleted_at IS NULL
            AND e.status NOT IN (${sql.join(
              [...SEAT_RELEASED_ENROLLMENT_STATUSES].map((status) => sql`${status}`),
              sql`, `,
            )})) AS used,
        (SELECT count(*)::int FROM session_class_sections s
          WHERE s.workspace_subdomain = ${subdomain} AND s.class_id = ${classId}
            AND s.status = 'active') AS "sectionCount",
        (SELECT coalesce(sum(s.capacity), 0)::int FROM session_class_sections s
          WHERE s.workspace_subdomain = ${subdomain} AND s.class_id = ${classId}
            AND s.status = 'active') AS "sectionCapacity",
        (SELECT count(*) > 0 FROM session_class_sections s
          WHERE s.workspace_subdomain = ${subdomain} AND s.class_id = ${classId}
            AND s.status = 'active' AND coalesce(s.capacity, 0) = 0) AS "unlimitedSection",
        (SELECT coalesce(sc.capacity, 0)::int FROM session_classes sc
          WHERE sc.workspace_subdomain = ${subdomain} AND sc.id = ${classId}) AS "classCapacity"
    `);
    const row = result.rows[0];
    if (!row) return false;
    if (Number(row.sectionCount) > 0) {
      if (row.unlimitedSection) return true;
      return Number(row.sectionCapacity) - Number(row.used) > 0;
    }
    return Number(row.classCapacity) === 0 || Number(row.classCapacity) - Number(row.used) > 0;
  });
}
