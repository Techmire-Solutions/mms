-- 0259_obligations_rls_policy_dedup.sql
--
-- Each obligation catalogue table carried TWO permissive RLS policies: the original
-- `<table>_tenant_isolation` from 0052 and the `tenant_isolation_policy` that 0076 created
-- (and that the Drizzle model documents). 0108 dropped the legacy policy for
-- `obligation_collections` only, leaving the five catalogue tables with both.
--
-- Permissive policies are OR-ed by PostgreSQL, so a duplicate is a latent defect rather than a
-- live leak today (the two predicates are identical), but it is exactly the pattern 0229 fixed:
-- any future clause added to `tenant_isolation_policy` — a soft-delete predicate, a stricter
-- check — would be silently defeated by the surviving legacy policy. A reviewer reading
-- `pg_policies` also cannot tell which policy governs.
--
-- This drops only the legacy names. The surviving `tenant_isolation_policy` has the same
-- predicate (`app.rls_bypass = 'on' OR workspace_subdomain = app.current_tenant`), so isolation
-- is unchanged; each table ends with exactly one policy.
--
-- Idempotent and lock-safe: `DROP POLICY IF EXISTS` on exactly-known names, no table rewrite.

SET LOCAL lock_timeout = '2s';

DROP POLICY IF EXISTS obligation_types_tenant_isolation ON "obligation_types";
DROP POLICY IF EXISTS mujtahids_tenant_isolation ON "mujtahids";
DROP POLICY IF EXISTS mujtahid_reps_tenant_isolation ON "mujtahid_reps";
DROP POLICY IF EXISTS wakala_types_tenant_isolation ON "wakala_types";
DROP POLICY IF EXISTS obligation_distributions_tenant_isolation ON "obligation_distributions";

-- Guard: every obligation table must still be FORCE-RLS with exactly one policy. A future
-- migration that drops a policy without a replacement fails here instead of silently relying on
-- an accidental second policy.
DO $$
DECLARE
  tbl text;
  policy_count integer;
  forced boolean;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'obligation_collections',
    'obligation_types',
    'mujtahids',
    'mujtahid_reps',
    'wakala_types',
    'obligation_distributions',
    'obligation_module_preferences'
  ]
  LOOP
    SELECT count(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = tbl;

    IF policy_count <> 1 THEN
      RAISE EXCEPTION 'RLS policy count for % is % (expected exactly 1)', tbl, policy_count;
    END IF;

    SELECT relforcerowsecurity INTO forced
    FROM pg_class
    WHERE oid = format('public.%I', tbl)::regclass;

    IF NOT forced THEN
      RAISE EXCEPTION 'RLS is not FORCE-enabled on %', tbl;
    END IF;
  END LOOP;
END $$;
