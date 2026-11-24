-- MMS Forward-only Migration: 0168_enrollment_ssot_backfill.sql
-- Phase 3 — enrollments become the source of truth for student ↔ session membership.
-- Converts legacy `student_enrolled_sessions` pairs that have NO enrollment row into confirmed
-- enrollments, but only where the placement is unambiguous: the session (live) has exactly one
-- class and that class exactly one section. Remaining pairs are left untouched and reported by
--   pnpm --filter mms-backend audit:enrollment-ssot
-- Idempotent: re-running inserts nothing (deterministic ids + NOT EXISTS guard).

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

INSERT INTO "enrollments" (
  "id", "workspace_subdomain", "student_id", "student_name", "session_id", "session_name",
  "class_id", "class_name", "section_id", "enrolled_date", "base_fee", "discount_type", "discount_label",
  "discount_pct", "discount_amt", "final_fee", "status", "payment_status", "notes"
)
SELECT 'enr-legacy-' || md5(p."workspace_subdomain" || ':' || p."student_id" || ':' || p."session_id"),
       p."workspace_subdomain", p."student_id", COALESCE(ct."name", ''), ses."id", ses."name",
       cls."id", cls."name", sec."id",
       CASE
         WHEN st."enrollment_date" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN left(st."enrollment_date", 10)
         WHEN ses."start_date" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN left(ses."start_date", 10)
         ELSE to_char(CURRENT_DATE, 'YYYY-MM-DD')
       END,
       ses."base_fee", 'none', '', 0, 0, ses."base_fee", 'confirmed', 'none',
       'Converted from legacy session membership (migration 0168)'
  FROM "student_enrolled_sessions" p
  JOIN "students" st ON st."workspace_subdomain" = p."workspace_subdomain" AND st."id" = p."student_id" AND st."deleted_at" IS NULL
  LEFT JOIN "contacts" ct ON ct."workspace_subdomain" = st."workspace_subdomain" AND ct."id" = st."contact_id"
  JOIN "sessions" ses ON ses."workspace_subdomain" = p."workspace_subdomain" AND ses."id" = p."session_id" AND ses."deleted_at" IS NULL
  JOIN "session_classes" cls ON cls."workspace_subdomain" = ses."workspace_subdomain" AND cls."session_id" = ses."id"
  JOIN "session_class_sections" sec ON sec."workspace_subdomain" = cls."workspace_subdomain" AND sec."class_id" = cls."id"
 WHERE (SELECT count(*) FROM "session_classes" c2 WHERE c2."workspace_subdomain" = ses."workspace_subdomain" AND c2."session_id" = ses."id") = 1
   AND (SELECT count(*) FROM "session_class_sections" s2 WHERE s2."workspace_subdomain" = cls."workspace_subdomain" AND s2."class_id" = cls."id") = 1
   AND NOT EXISTS (
     SELECT 1 FROM "enrollments" e
      WHERE e."workspace_subdomain" = p."workspace_subdomain" AND e."student_id" = p."student_id" AND e."session_id" = p."session_id"
   )
ON CONFLICT ("workspace_subdomain", "id") DO NOTHING;
