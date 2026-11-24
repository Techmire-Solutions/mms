-- MMS Forward-only Migration: 0203_contacts_merge_reference_repair.sql
-- Re-points references left behind by contact merges that ran before the merge
-- re-parent set covered every owning table (R4-01/R4-10).
--
-- A merged-away contact is archived with `deletion_reason = 'Merged into <id>'`,
-- so the survivor is recoverable from the row itself. Every statement below is
-- idempotent: it only touches rows that still point at an archived contact whose
-- survivor exists in the same workspace, and it leaves already-correct rows alone.
--
-- Pure DML: no DDL, no lock escalation beyond the row locks the updates take.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

-- 1. Faculty employments: archive an active row that would collide with the
--    survivor's own active employment (`faculty_employments_contact_active_uidx`).
WITH merged AS (
  SELECT
    workspace_subdomain,
    id AS loser_id,
    substring(deletion_reason FROM 'Merged into (.+)$') AS keep_id
  FROM contacts
  WHERE deleted_at IS NOT NULL
    AND deletion_reason LIKE 'Merged into %'
),
targets AS (
  SELECT m.workspace_subdomain, m.loser_id, m.keep_id
  FROM merged m
  JOIN contacts k
    ON k.workspace_subdomain = m.workspace_subdomain
   AND k.id = m.keep_id
  WHERE m.keep_id IS NOT NULL
    AND m.keep_id <> m.loser_id
)
UPDATE faculty_employments fe
SET deleted_at = now(),
    updated_at = now(),
    deletion_reason = COALESCE(fe.deletion_reason, 'Merged into ' || t.keep_id)
FROM targets t
WHERE fe.workspace_subdomain = t.workspace_subdomain
  AND fe.contact_id = t.loser_id
  AND fe.deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM faculty_employments k
    WHERE k.workspace_subdomain = t.workspace_subdomain
      AND k.contact_id = t.keep_id
      AND k.deleted_at IS NULL
  );
--> statement-breakpoint

-- 2. Faculty employments: move every remaining row to the survivor.
WITH merged AS (
  SELECT
    workspace_subdomain,
    id AS loser_id,
    substring(deletion_reason FROM 'Merged into (.+)$') AS keep_id
  FROM contacts
  WHERE deleted_at IS NOT NULL
    AND deletion_reason LIKE 'Merged into %'
),
targets AS (
  SELECT m.workspace_subdomain, m.loser_id, m.keep_id
  FROM merged m
  JOIN contacts k
    ON k.workspace_subdomain = m.workspace_subdomain
   AND k.id = m.keep_id
  WHERE m.keep_id IS NOT NULL
    AND m.keep_id <> m.loser_id
)
UPDATE faculty_employments fe
SET contact_id = t.keep_id
FROM targets t
WHERE fe.workspace_subdomain = t.workspace_subdomain
  AND fe.contact_id = t.loser_id;
--> statement-breakpoint

-- 3. Workshop registrations: drop duplicates the survivor already holds, then
--    move the rest.
WITH merged AS (
  SELECT
    workspace_subdomain,
    id AS loser_id,
    substring(deletion_reason FROM 'Merged into (.+)$') AS keep_id
  FROM contacts
  WHERE deleted_at IS NOT NULL
    AND deletion_reason LIKE 'Merged into %'
),
targets AS (
  SELECT m.workspace_subdomain, m.loser_id, m.keep_id
  FROM merged m
  JOIN contacts k
    ON k.workspace_subdomain = m.workspace_subdomain
   AND k.id = m.keep_id
  WHERE m.keep_id IS NOT NULL
    AND m.keep_id <> m.loser_id
)
DELETE FROM workshop_participants loser
USING targets t
WHERE loser.workspace_subdomain = t.workspace_subdomain
  AND loser.contact_id = t.loser_id
  AND EXISTS (
    SELECT 1 FROM workshop_participants keep_row
    WHERE keep_row.workspace_subdomain = loser.workspace_subdomain
      AND keep_row.workshop_id = loser.workshop_id
      AND keep_row.contact_id = t.keep_id
      AND keep_row.deleted_at IS NULL
  );
--> statement-breakpoint

-- 4. Workshop registrations: move the remaining rows.
WITH merged AS (
  SELECT
    workspace_subdomain,
    id AS loser_id,
    substring(deletion_reason FROM 'Merged into (.+)$') AS keep_id
  FROM contacts
  WHERE deleted_at IS NOT NULL
    AND deletion_reason LIKE 'Merged into %'
),
targets AS (
  SELECT m.workspace_subdomain, m.loser_id, m.keep_id
  FROM merged m
  JOIN contacts k
    ON k.workspace_subdomain = m.workspace_subdomain
   AND k.id = m.keep_id
  WHERE m.keep_id IS NOT NULL
    AND m.keep_id <> m.loser_id
)
UPDATE workshop_participants wp
SET contact_id = t.keep_id
FROM targets t
WHERE wp.workspace_subdomain = t.workspace_subdomain
  AND wp.contact_id = t.loser_id;
--> statement-breakpoint

-- 5. Family invoices: re-point the billing contact.
WITH merged AS (
  SELECT
    workspace_subdomain,
    id AS loser_id,
    substring(deletion_reason FROM 'Merged into (.+)$') AS keep_id
  FROM contacts
  WHERE deleted_at IS NOT NULL
    AND deletion_reason LIKE 'Merged into %'
),
targets AS (
  SELECT m.workspace_subdomain, m.loser_id, m.keep_id
  FROM merged m
  JOIN contacts k
    ON k.workspace_subdomain = m.workspace_subdomain
   AND k.id = m.keep_id
  WHERE m.keep_id IS NOT NULL
    AND m.keep_id <> m.loser_id
)
UPDATE finance_invoices fi
SET family_contact_id = t.keep_id
FROM targets t
WHERE fi.workspace_subdomain = t.workspace_subdomain
  AND fi.family_contact_id = t.loser_id;
