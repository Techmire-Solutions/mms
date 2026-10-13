---
name: mms-incident-response
description: Runs the MMS production incident procedure on the Hetzner host — diagnose, decide rollback vs fix-forward, execute, and verify the site is genuinely serving again. Use when production is down, a deploy broke the site, or a release must be reverted. Do NOT use for routine deploys (use mms-ops-deploy), single-request error investigations (use mms-error-triage), or a wedged background worker (use mms-queue-ops).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-04
compatibility: Requires SSH access to the Hetzner VPS with PM2 and Apache; do not run destructive steps without an explicit instruction.
---

# MMS Incident Response

**Rules (norms SSOT):** `mms-ops-infrastructure.mdc` (ports 5002/3000, health endpoints, PM2/Apache topology, CI deploy flow) · `mms-agent-universal.mdc` (say "commit" / "push" explicitly).

## When to use

- Production is down, a deploy broke the site, or a release must be reverted
- Running diagnose → rollback → verify on the host

## First 5 minutes — stabilise before diagnosing

1. **Confirm the blast radius:** is it one tenant subdomain, all tenants, or the apex platform console? A single tenant points at data/config; everything points at the process, the proxy, or the database.
2. **Do not deploy a fix yet.** Capture the current state first — it is the only evidence you get:
   ```bash
   bash scripts/server-diagnose.sh apps/backend/.env
   pm2 status
   pm2 logs mmsv2-backend --lines 200
   ```
3. **Decide: rollback or fix-forward.**
   - Bad deploy, config change, or a release that broke the site → **rollback** (fast, known-good).
   - Data corruption, a migration that already ran, or an external dependency outage → fix-forward; rolling back code does not undo a forward migration (`mms-data-layer.mdc` §7).
4. **Communicate the decision** (what is broken, what you are doing, when you will re-check) before spending time on root cause.

## Rollback

```bash
bash scripts/deploy-rollback.sh list          # retained releases under .deploy-releases/
bash scripts/deploy-rollback.sh              # previous release (2nd newest)
bash scripts/deploy-rollback.sh <sha>        # a specific release
bash scripts/deploy-verify.sh                # local backend + public site reachability
```

Notes that matter: the rollback restores a dist tarball and reloads PM2 — it does **not** reverse database migrations, and it will not fix an `.env` change (use `scripts/merge-backend-env.sh` deliberately). If only one process is sick, prefer the narrower recovery script (`scripts/deploy-recover-backend.sh`) so you do not roll back a healthy half.

## Fix-forward

1. Reproduce locally against the same shape of data — never debug directly on production.
2. Fix, verify (`pnpm typecheck && pnpm test`, plus the ratchets), and only then deploy through the normal CI path (`.github/workflows/deploy.yml`, `DEPLOY_SHA`).
3. Watch the deploy: `bash scripts/deploy-verify.sh` must pass, and the PM2 app must stay online (a crash-loop looks like "deployed" in some tooling).

## Verification — the incident is not over until this passes

- Backend healthy on **5002** locally (`127.0.0.1:5002`), Apache proxying to it, no 502/504 from the public URL.
- `/health` and `/ready` green (`mms-ops-infrastructure.mdc`).
- One real tenant login + one authenticated read (a page that hits the DB), plus one write if the incident was data-related.
- Worker process (`mmsv2-worker`) online — an incident "fixed" while the worker crash-loops will resurface as stuck jobs.
- Record what happened: the SHA before/after, the trigger, the detection gap, and the follow-up item. Systemic gaps belong in the debt register (`mms-migration-status.mdc`) or a new rule/check — not only in chat.

## Hard rules

- Never force-push or rewrite history during an incident; `git push` only if the user says "push".
- Never run `drizzle-kit push`, drop tables, or "clean up" rows that are evidence (`mms-agent-universal.mdc`, `mms-schema-migrate`).
- Never disable a security control (rate limits, CORS/Origin checks, RLS) to make the site come back — that converts an outage into a breach.
- Never claim recovery from `pm2 status` alone; verify from the public URL.

## Related skills

`mms-ops-deploy` (normal deploy path, Apache isolation), `mms-queue-ops` (worker-specific), `mms-error-triage` (single-request investigations), `mms-linux-compatibility` (case-ending/portability causes of deploy-only failures).
