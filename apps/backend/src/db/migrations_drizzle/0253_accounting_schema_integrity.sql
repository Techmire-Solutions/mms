-- 0253_accounting_schema_integrity.sql
-- Forward-only. Accounting schema/persistence hardening — see
-- docs/accounting-schema-persistence-audit-2026-11-13.md.
--
-- Why each block exists
-- ---------------------
--   * The Chart of Accounts had no hierarchy at all: no parent column, so the tree
--     could only be implied by free-text `code` prefixes and nothing could be
--     validated. `parent_account_id` is added with a composite self-FK, and a
--     trigger rejects self-parenting, cycles and depth > 8 for every writer,
--     including raw SQL. The trigger takes a per-tenant advisory lock first, so two
--     concurrent reparents cannot each observe an acyclic tree and together close a
--     cycle.
--   * Account codes were only plain-indexed, so two active accounts could share a
--     code. Duplicates are disambiguated first (the 0127 pattern) and a partial
--     unique index makes the shared COA uniqueness real. Trashed accounts stay out
--     of the constraint so a code is recyclable.
--   * `accounting_entries_posted_columns_guard` froze date/status/fiscal-year/source
--     but NOT `ref`. The voucher number is the ledger control the counter table
--     exists to protect: a renumber frees the old number (the unique index is
--     partial on `deleted_at IS NULL`) and breaks the audit chain. `ref` and
--     `reversed_ref` are frozen too. `created_by` is deliberately left mutable — it
--     is attribution, not ledger identity, and a partial payload that omits it
--     would otherwise fail an idempotent re-save.
--   * Archiving an account silently orphaned the posting rules: soft delete bypasses
--     every FK, so the cash/AR/retained-earnings account could be trashed while the
--     rules still pointed at it, breaking every later posting. A trigger now refuses
--     the archive until the rules are repointed.
--   * Restores never stamped `restored_at`/`restored_by` on accounts even though the
--     sextuple and every reader expect them. The account path is fixed in code; this
--     migration makes the provenance non-optional at the database for both accounting
--     tables.
--   * `accounting_posting_periods.status` was free text while the 0249 balance guard
--     decides whether a period is locked by `status = 'closed'`. `POSTING_PERIOD_STATUSES`
--     in `@mms/shared` already documents this constraint; it now exists.
--   * Journal-line `exchange_rate` had no positivity rule while both rate tables do
--     (`accounting_exchange_rates_positive`, `fx_reference_rates_positive`).
--   * Indexes: the voucher allocation collision probe filters `ref = ANY(...)` with
--     no `deleted_at` predicate, so the partial unique ref index cannot serve it and
--     every allocation scanned the tenant's journal; the journal date range and the
--     COA directory/fiscal-year ordering and type filter had no partial index either;
--     the tag filter could only scan by entry.
--
-- NOT VALID constraints are used where legacy rows may predate the rule; every new
-- write is checked. `app.allow_hard_purge` / `app.allow_ledger_maintenance` keep the
-- workspace purge, backup restore and data migrations working.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

-- ── 1. Posted vouchers cannot be renumbered ──────────────────────────────────
CREATE OR REPLACE FUNCTION accounting_entries_posted_columns_guard()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('app.allow_hard_purge', true) = 'true'
     OR current_setting('app.allow_ledger_maintenance', true) = 'true' THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'posted' AND (
       NEW.date IS DISTINCT FROM OLD.date
    OR NEW.ref IS DISTINCT FROM OLD.ref
    OR NEW.status IS DISTINCT FROM OLD.status
    OR NEW.fiscal_year_id IS DISTINCT FROM OLD.fiscal_year_id
    OR NEW.source_type IS DISTINCT FROM OLD.source_type
    OR NEW.source_id IS DISTINCT FROM OLD.source_id
    OR NEW.reversed_ref IS DISTINCT FROM OLD.reversed_ref
  ) THEN
    RAISE EXCEPTION 'Posted journal entry % is immutable — post a reversal instead', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

-- ── 2. Chart-of-accounts hierarchy ───────────────────────────────────────────
ALTER TABLE "accounting_accounts" ADD COLUMN IF NOT EXISTS "parent_account_id" text;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "accounting_accounts" ADD CONSTRAINT "accounting_accounts_parent_fk"
    FOREIGN KEY ("workspace_subdomain", "parent_account_id")
    REFERENCES "accounting_accounts" ("workspace_subdomain", "id")
    ON DELETE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "accounting_accounts" ADD CONSTRAINT "accounting_accounts_parent_not_self_chk"
    CHECK ("parent_account_id" IS NULL OR "parent_account_id" <> "id") NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "accounting_accounts_workspace_parent_active_idx"
  ON "accounting_accounts" USING btree ("workspace_subdomain", "parent_account_id")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION accounting_account_hierarchy_guard()
RETURNS TRIGGER AS $$
DECLARE
  v_cursor  text := NEW.parent_account_id;
  v_ancestors integer := 0;
BEGIN
  IF NEW.parent_account_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF current_setting('app.allow_hard_purge', true) = 'true'
     OR current_setting('app.allow_ledger_maintenance', true) = 'true' THEN
    RETURN NEW;
  END IF;
  IF NEW.parent_account_id = NEW.id THEN
    RAISE EXCEPTION 'Account % cannot be its own parent', NEW.id
      USING ERRCODE = 'check_violation';
  END IF;

  -- Serialize hierarchy writes per workspace: two concurrent reparents could each
  -- read an acyclic tree and together close a loop that neither sees.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('accounting-coa:' || NEW.workspace_subdomain, 0)
  );

  WHILE v_cursor IS NOT NULL LOOP
    v_ancestors := v_ancestors + 1;
    IF v_ancestors > 8 THEN
      RAISE EXCEPTION 'Account hierarchy cannot exceed 8 levels (parent chain of %)', NEW.id
        USING ERRCODE = 'check_violation';
    END IF;
    IF v_cursor = NEW.id THEN
      RAISE EXCEPTION 'Nesting account % under % would create a hierarchy cycle',
        NEW.id, NEW.parent_account_id USING ERRCODE = 'check_violation';
    END IF;
    SELECT parent_account_id INTO v_cursor
      FROM accounting_accounts
     WHERE workspace_subdomain = NEW.workspace_subdomain AND id = v_cursor;
    IF NOT FOUND THEN
      v_cursor := NULL;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_accounting_accounts_hierarchy_guard ON "accounting_accounts";
--> statement-breakpoint
CREATE TRIGGER trg_accounting_accounts_hierarchy_guard
  BEFORE INSERT OR UPDATE OF parent_account_id ON "accounting_accounts"
  FOR EACH ROW EXECUTE FUNCTION accounting_account_hierarchy_guard();
--> statement-breakpoint

-- ── 3. One active account per code ──────────────────────────────────────────
-- Disambiguate pre-existing active duplicates before the unique index (0127 pattern).
DO $$
DECLARE
  dup_record RECORD;
  new_code   TEXT;
  counter    INT;
BEGIN
  FOR dup_record IN
    SELECT "workspace_subdomain", "id", "code"
    FROM (
      SELECT
        "workspace_subdomain",
        "id",
        "code",
        ROW_NUMBER() OVER (
          PARTITION BY "workspace_subdomain", "code"
          ORDER BY "created_at" ASC, "id" ASC
        ) AS rn
      FROM "accounting_accounts"
      WHERE "deleted_at" IS NULL
    ) sub
    WHERE sub.rn > 1
  LOOP
    counter := 1;
    LOOP
      new_code := LEFT(dup_record."code", 40) || '-dup-' || counter;
      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM "accounting_accounts"
        WHERE "workspace_subdomain" = dup_record."workspace_subdomain"
          AND "code" = new_code
          AND "deleted_at" IS NULL
      );
      counter := counter + 1;
    END LOOP;

    UPDATE "accounting_accounts"
    SET "code" = new_code
    WHERE "workspace_subdomain" = dup_record."workspace_subdomain"
      AND "id" = dup_record."id";
  END LOOP;
END $$;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "accounting_accounts_workspace_code_active_uidx"
  ON "accounting_accounts" USING btree ("workspace_subdomain", "code")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint

-- ── 4. An account the posting rules point at cannot be archived ─────────────
CREATE OR REPLACE FUNCTION accounting_account_archive_guard()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('app.allow_hard_purge', true) = 'true'
     OR current_setting('app.allow_ledger_maintenance', true) = 'true' THEN
    RETURN NEW;
  END IF;
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
        FROM accounting_posting_rules r
       WHERE r.workspace_subdomain = NEW.workspace_subdomain
         AND NEW.id IN (
           r.ar_account_id, r.cash_account_id, r.bank_account_id, r.income_account_id,
           r.discount_account_id, r.fx_realized_account_id, r.fx_unrealized_account_id,
           r.fx_rounding_account_id, r.cta_account_id
         )
    ) THEN
      RAISE EXCEPTION 'Account % is referenced by the posting rules — repoint the rules before archiving it',
        NEW.id USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_accounting_accounts_config_archive_guard ON "accounting_accounts";
--> statement-breakpoint
CREATE TRIGGER trg_accounting_accounts_config_archive_guard
  BEFORE UPDATE OF deleted_at ON "accounting_accounts"
  FOR EACH ROW EXECUTE FUNCTION accounting_account_archive_guard();
--> statement-breakpoint

-- ── 5. A restore must be attributable ───────────────────────────────────────
CREATE OR REPLACE FUNCTION accounting_restore_attribution_guard()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('app.allow_hard_purge', true) = 'true'
     OR current_setting('app.allow_ledger_maintenance', true) = 'true' THEN
    RETURN NEW;
  END IF;
  -- `restored_at < OLD.deleted_at` is a leftover attribution from an earlier
  -- restore: the archive path clears it, and replaying it would claim this restore
  -- was performed before the deletion it undoes.
  IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL
     AND (
       NEW.restored_at IS NULL
       OR NEW.restored_by IS NULL
       OR NEW.restored_at < OLD.deleted_at
     ) THEN
    RAISE EXCEPTION 'Restoring a row in % must stamp restored_at and restored_by',
      TG_TABLE_NAME USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_accounting_accounts_restore_attribution ON "accounting_accounts";
--> statement-breakpoint
CREATE TRIGGER trg_accounting_accounts_restore_attribution
  BEFORE UPDATE OF deleted_at ON "accounting_accounts"
  FOR EACH ROW EXECUTE FUNCTION accounting_restore_attribution_guard();
--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_accounting_entries_restore_attribution ON "accounting_entries";
--> statement-breakpoint
CREATE TRIGGER trg_accounting_entries_restore_attribution
  BEFORE UPDATE OF deleted_at ON "accounting_entries"
  FOR EACH ROW EXECUTE FUNCTION accounting_restore_attribution_guard();
--> statement-breakpoint

-- ── 6. Posting-period status is the period lock; pin it to the shared enum ──
DO $$
DECLARE
  bad_periods text;
BEGIN
  SELECT string_agg(format('%s: %s', workspace_subdomain, status), '; ')
    INTO bad_periods
    FROM accounting_posting_periods
   WHERE status NOT IN ('open', 'closed');

  IF bad_periods IS NOT NULL THEN
    RAISE EXCEPTION 'accounting_posting_periods has statuses outside the shared enum: %', bad_periods
      USING HINT = 'Fix those rows to open/closed, then re-run the migration.';
  END IF;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "accounting_posting_periods"
    ADD CONSTRAINT "accounting_posting_periods_status_check"
    CHECK ("status" IN ('open', 'closed')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "accounting_posting_periods"
  VALIDATE CONSTRAINT "accounting_posting_periods_status_check";
--> statement-breakpoint

-- ── 7. Journal-line exchange rate must be positive ──────────────────────────
DO $$ BEGIN
  ALTER TABLE "accounting_journal_lines" ADD CONSTRAINT "accounting_journal_lines_rate_positive_chk"
    CHECK ("exchange_rate" IS NULL OR "exchange_rate" > 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

-- ── 8. Indexes the lists, allocation probe and directory ordering need ──────
-- The allocation collision probe filters `ref = ANY(...)` with no `deleted_at`
-- predicate, so the partial unique ref index cannot serve it.
CREATE INDEX IF NOT EXISTS "accounting_entries_workspace_ref_idx"
  ON "accounting_entries" USING btree ("workspace_subdomain", "ref");
--> statement-breakpoint
-- Journal date range (`buildEntryListConditions`) with the active-row filter.
CREATE INDEX IF NOT EXISTS "accounting_entries_workspace_date_active_idx"
  ON "accounting_entries" USING btree ("workspace_subdomain", "date", "id")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint
-- COA type filter — the declared index is not partial, so the active list missed it.
CREATE INDEX IF NOT EXISTS "accounting_accounts_workspace_type_active_idx"
  ON "accounting_accounts" USING btree ("workspace_subdomain", "type")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint
-- COA and fiscal-year default directory ordering (`created_at DESC, id`).
CREATE INDEX IF NOT EXISTS "accounting_accounts_workspace_created_active_idx"
  ON "accounting_accounts" USING btree ("workspace_subdomain", "created_at" DESC, "id")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounting_fiscal_years_workspace_created_active_idx"
  ON "accounting_fiscal_years" USING btree ("workspace_subdomain", "created_at" DESC, "id")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint
-- Tag filter: the correlated probe could only be served by the entry-first index.
CREATE INDEX IF NOT EXISTS "accounting_entry_tags_workspace_tag_idx"
  ON "accounting_entry_tags" USING btree ("workspace_subdomain", "tag")
  INCLUDE ("entry_id");
--> statement-breakpoint

-- ── 9. Report existing data, never block this deploy ────────────────────────
DO $$
DECLARE
  v_dupe_codes bigint;
  v_deep bigint;
BEGIN
  SELECT count(*) INTO v_dupe_codes
    FROM (
      SELECT workspace_subdomain, code
        FROM accounting_accounts
       WHERE deleted_at IS NULL
       GROUP BY workspace_subdomain, code
      HAVING count(*) > 1
    ) dupes;
  IF v_dupe_codes > 0 THEN
    RAISE WARNING '0253: % duplicate active account code(s) remain after disambiguation', v_dupe_codes;
  END IF;

  WITH RECURSIVE ancestors(root_id, workspace_subdomain, parent_account_id, depth) AS (
    SELECT a.id, a.workspace_subdomain, a.parent_account_id, 1
      FROM accounting_accounts a
     WHERE a.parent_account_id IS NOT NULL
    UNION ALL
    SELECT anc.root_id, anc.workspace_subdomain, p.parent_account_id, anc.depth + 1
      FROM ancestors anc
      JOIN accounting_accounts p
        ON p.workspace_subdomain = anc.workspace_subdomain
       AND p.id = anc.parent_account_id
     WHERE p.parent_account_id IS NOT NULL
       AND anc.depth < 12
  )
  SELECT count(DISTINCT root_id) INTO v_deep FROM ancestors WHERE depth > 8;
  IF v_deep > 0 THEN
    RAISE WARNING '0253: % account(s) sit deeper than 8 levels and will fail the next reparent', v_deep;
  END IF;
END $$;
