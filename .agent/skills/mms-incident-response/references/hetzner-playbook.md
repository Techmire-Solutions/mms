# Hetzner Production Incident Playbook

Operational guide for responding to production outages, failed deployments, and service degradations on the Hetzner VPS host.

## 1. Quick Diagnostic Sweep

Run the server diagnostic script to inspect processes, ports, memory, and Apache proxy state:
```bash
bash scripts/server-diagnose.sh apps/backend/.env
```

Key checks:
1. **Port 5002 reachability:** `curl -sI http://127.0.0.1:5002/health`
2. **PM2 process table:** `pm2 status`
   - `mmsv2-backend` (API process)
   - `mmsv2-worker` (BullMQ worker process)
3. **Apache reverse proxy status:** `systemctl status apache2`

## 2. Targeted Process Recovery

If the API or worker crashed without code defects (e.g. OOM or hung socket), recover the backend process cleanly without a full rollback:
```bash
bash scripts/deploy-recover-backend.sh
```

## 3. Rollback Mechanics

When a deploy has broken production:
```bash
# List available release backups
bash scripts/deploy-rollback.sh list

# Rollback to the previous release
bash scripts/deploy-rollback.sh

# Or rollback to an exact release SHA
bash scripts/deploy-rollback.sh <sha>
```

Verify the post-rollback status:
```bash
bash scripts/deploy-verify.sh
```

## 4. Environment File Synchronization

If backend environment variables drift or need merging:
```bash
bash scripts/merge-backend-env.sh
```
