---
name: mms-ops-deploy
description: Operates the MMS production deployment on Hetzner — Apache vhost isolation, PORT 5002, MMS_APP_DOMAIN, GitHub Actions deploy, PM2 topology, and merge-backend-env. Use when fixing a production server, a failed deploy, or wrong domain routing. Do NOT use for local dev servers (use mms-dev-setup), repo-wide portability auditing (use mms-linux-compatibility), or diagnosing a live outage (use mms-incident-response).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-16
compatibility: Requires SSH access to the Hetzner VPS and PM2/Apache on the server; never run against production without an explicit instruction.
---

# MMS Ops & Production Deploy

**Rules (norms SSOT):** `mms-ops-infrastructure.mdc` · `mms-auth-security.mdc` · `mms-completion-review.mdc`.

## When to use

- Fixing a production server, failed deploy, or wrong domain routing
- Operating Apache/PM2 deploy on the Hetzner host

Operational procedure for deploying, configuring, and verifying the production MMS environment on Hetzner VPS.

## 1. Critical Invariants

- **Production Port 5002**: Production Fastify binds strictly to `127.0.0.1:5002` behind Apache reverse proxy. Ports 3000/3001 are forbidden on production.
- **Automated Deployments**: Deploy exclusively via GitHub Actions artifacts (`deploy.yml` → `deploy-on-server.sh`). Never edit code directly on production hosts.
- **Strict Apache Vhost Isolation**: Foreign domains must never proxy to MMS (`apply-production-host-isolation.sh`).
- **Database Safety**: Schema migrations run forward-only on server boot (`initDb`). `drizzle-kit push` is strictly banned in production.
- **Rollback-Compatible Migrations**: `deploy-rollback.sh` restores only `dist/`; migrations already applied stay applied. Every migration must be expand/contract — release N-1 must keep running against release N's schema — or automated rollback leaves a broken site.
- **Build Once, Promote**: CI's push run on `main` builds, checksums, and attests `mms-dist.tar.gz`; `deploy.yml` downloads that artifact and runs `gh attestation verify` before shipping it. Only manual `workflow_dispatch` rebuilds, and it must target a commit on `main` with green CI unless `allow_unverified` is set.
- **SSH Trust & Secrets**: Host key is pinned via the `SSH_KNOWN_HOSTS` secret (`.github/actions/ssh-setup`). Remote steps run through `scripts/ci/ssh-exec.sh`, which streams `%q`-quoted env over stdin — never interpolate secrets into the ssh argv. No GitHub token is sent to the server (public repo, anonymous fetch).
- **Do Not Set MMS_API_URL**: Platform serves unified apex + tenant routes from `https://${MMS_APP_DOMAIN}`. Deploy scripts strip legacy `MMS_API_URL`.

## 2. Domain & Subdomain Architecture

- **Platform Apex**: `MMS_APP_DOMAIN` (e.g. `mmsv2.example.com`) for platform auth and onboarding.
- **Tenant Subdomains**: `{slug}.MMS_APP_DOMAIN` for individual madrasa workspaces.
- **Subdomain Triad**:
  1. DNS: `A`/`CNAME` record for apex and `*.MMS_APP_DOMAIN` pointing to server IP.
  2. TLS: Wildcard SSL certificate covering `*.MMS_APP_DOMAIN` (DNS-01 challenge via certbot).
  3. Apache: `mmsv2.conf` with `ServerAlias *.MMS_APP_DOMAIN` proxying to `http://127.0.0.1:5002`.

## 3. Server Execution Commands (`/var/www/mmsv2`)

```bash
# Environment & Host Configuration
bash scripts/merge-backend-env.sh apps/backend/.env
bash scripts/apply-production-host-isolation.sh apps/backend/.env

# Deployment & Rollback
bash scripts/deploy-on-server.sh          # Expects DEPLOY_SHA + /tmp/mms-dist.tar.gz
bash scripts/deploy-rollback.sh [sha|list]

# Diagnostics & Tenant Verification
bash scripts/server-diagnose.sh apps/backend/.env
bash scripts/verify-tenant-hosts.sh <subdomain> apps/backend/.env
```

## 4. Production Health Verification

Run post-deployment verification checks against apex and tenant endpoints:

```bash
# Apex Health Checks
curl -fsS "https://${MMS_APP_DOMAIN}/health"
curl -fsS "https://${MMS_APP_DOMAIN}/ready"
curl -fsS "https://${MMS_APP_DOMAIN}/api/public/deployment-config"
curl -fsS "https://${MMS_APP_DOMAIN}/api/platform/auth/setup/status"

# Tenant Health Check
curl -fsS "https://<tenant-slug>.${MMS_APP_DOMAIN}/health"
```

## References

- Hetzner Deployment & Rollback Runbook: `references/hetzner-deploy-cheatsheet.md`

## Related skills

`mms-incident-response`, `mms-release-versioning`, `mms-dev-setup`, `mms-linux-compatibility`.
