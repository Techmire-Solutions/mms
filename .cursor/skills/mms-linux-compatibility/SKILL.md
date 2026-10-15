---
name: mms-linux-compatibility
description: Audits the repository for Linux/Ubuntu VPS portability — CRLF line endings, case-sensitive imports, execute bits, and path casing. Use when preparing a deploy or chasing an error that only reproduces on the server. Do NOT use for local workstation setup (use mms-dev-setup) or for Apache/domain routing and PM2 topology (use mms-ops-deploy).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-16
---

# Linux VPS Compatibility Verification Workflow

**Rule (norms SSOT):** `mms-ops-infrastructure.mdc` · `mms-completion-review.mdc`.

## When to use

- Preparing a deploy or chasing an error that only reproduces on the server
- Auditing path case, line endings, or Linux/VPS portability

## Anti-Patterns & Banned Operations

- ❌ **NEVER commit CRLF line endings**: All `.sh`, `.json`, `.ts`, and config files must use LF line endings.
- ❌ **NEVER use case-mismatched imports**: Linux paths are strictly case-sensitive. Imports like `'./user'` for `'./User.js'` break in CI/VPS.
- ❌ **NEVER leave scripts non-executable**: Ensure all deployment and migration helper scripts have `chmod +x`.
- ❌ **NEVER run processes as root**: Fastify process on Ubuntu VPS runs under `deploy-user` with scoped write permissions.

Follow this workflow to verify that code and scripts are compatible with a Linux environment before deploying them to the Ubuntu VPS.

## 1. Line Ending Verification
Ensure all script files have Unix-style LF line endings.
- Run the following command to check if any script contains CRLF line endings:
  ```bash
  git grep -I -I $'\r' -- 'scripts/**/*.sh' || echo "All scripts clean of CRLF"
  ```
- If a file is found with CRLF, convert it to LF using `sed` or `tr`:
  ```bash
  tr -d '\r' < script.sh > script_clean.sh && mv script_clean.sh script.sh
  chmod +x script.sh
  ```

## 2. File and Folder Name Casing Check
Verify that all TypeScript import statements match the exact filename casing on disk.
- Since Mac OS filesystems are case-insensitive by default, running typechecks locally using `pnpm typecheck` compiles strict casing.
- Enforce casing check by building the shared package first and compiling the backend:
  ```bash
  pnpm --filter @mms/shared build && pnpm --filter mms-backend typecheck
  ```

## 3. Directory and Permissions Setup on Ubuntu VPS
When provisioning the server directory structure, apply strict ownership and permissions.
- Make all source directories read-only for the running Node process.
- Only the `data` and `.logs` directories should be writable:
  ```bash
  # Execute on VPS
  sudo chown -R deploy-user:deploy-user /var/www/mmsv2
  chmod -R 755 /var/www/mmsv2
  chmod -R 775 /var/www/mmsv2/data
  chmod -R 775 /var/www/mmsv2/.logs
  ```

## 4. PM2 Process Management on VPS
To manage application processes securely and ensure they survive reboots:
- Start the server under PM2:
  ```bash
  pm2 start ecosystem.config.cjs --only mmsv2-backend --update-env
  ```
- Configure PM2 to start on system boot:
  ```bash
  pm2 startup
  pm2 save
  ```
- Check logs and monitor performance:
  ```bash
  pm2 logs mmsv2-backend --lines 50
  pm2 status
  ```

## Script

`.agent/skills/mms-linux-compatibility/scripts/check-linux-compat.sh` audits CRLF line endings and missing execute bits across `scripts/`, `.agent/`, `apps/*/src`, `.github/workflows`, and `e2e/`:

```bash
bash .agent/skills/mms-linux-compatibility/scripts/check-linux-compat.sh
```

Run it before any deploy; it exits non-zero on the first class of failure it finds.

## Related skills

`mms-ops-deploy`, `mms-dev-setup`, `mms-incident-response`.
