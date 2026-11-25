-- MMS Forward-only Migration: 0213_enrollment_membership_archive_guard.sql
-- The membership view is the derived "student ↔ session" contract. It already excluded
-- deleted/released enrollments and required the session row to exist, but it never checked
-- whether the session or the student was archived — an enrollment left live under an
-- archived parent still rendered as a membership. Restores are guarded in the app, but
-- direct writes/imports are not, and the view is the read contract every module trusts.
SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

CREATE OR REPLACE VIEW "student_session_memberships" WITH (security_invoker = true) AS
SELECT min(e."id") AS "id", e."workspace_subdomain", e."student_id", e."session_id",
       0 AS "sort_order", min(e."created_at") AS "created_at"
  FROM "enrollments" e
 WHERE e."deleted_at" IS NULL
   AND e."status" NOT IN ('cancelled', 'withdrawn', 'promoted', 'retained', 'graduated', 'left')
   AND EXISTS (SELECT 1 FROM "sessions" ses
                WHERE ses."workspace_subdomain" = e."workspace_subdomain"
                  AND ses."id" = e."session_id"
                  AND ses."deleted_at" IS NULL)
   AND EXISTS (SELECT 1 FROM "students" st
                WHERE st."workspace_subdomain" = e."workspace_subdomain"
                  AND st."id" = e."student_id"
                  AND st."deleted_at" IS NULL)
 GROUP BY e."workspace_subdomain", e."student_id", e."session_id"
UNION ALL
SELECT l."id", l."workspace_subdomain", l."student_id", l."session_id", l."sort_order", l."created_at"
  FROM "student_enrolled_sessions_legacy" l
 WHERE NOT EXISTS (
   SELECT 1 FROM "enrollments" h
    WHERE h."workspace_subdomain" = l."workspace_subdomain"
      AND h."student_id" = l."student_id" AND h."session_id" = l."session_id")
   AND EXISTS (SELECT 1 FROM "sessions" ses
                WHERE ses."workspace_subdomain" = l."workspace_subdomain"
                  AND ses."id" = l."session_id"
                  AND ses."deleted_at" IS NULL)
   AND EXISTS (SELECT 1 FROM "students" st
                WHERE st."workspace_subdomain" = l."workspace_subdomain"
                  AND st."id" = l."student_id"
                  AND st."deleted_at" IS NULL);
--> statement-breakpoint
