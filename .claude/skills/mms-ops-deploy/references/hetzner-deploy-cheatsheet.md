# Hetzner Production Deployment & Infrastructure Runbook

This runbook documents the Hetzner VPS host architecture, Apache reverse-proxy isolation, PM2 process management, and release rollback procedures.

---

## 1. Host Architecture & Network Topology

```
Internet (HTTPS 443)
       │
       ▼
[Apache 2.4 Reverse Proxy] (TLS Termination, Wildcard Certbot DNS-01)
       │
       ├─ ServerName: ${MMS_APP_DOMAIN} (Apex)
       ├─ ServerAlias: *.${MMS_APP_DOMAIN} (Tenants)
       │
       ▼ ProxyPass http://127.0.0.1:5002
[Fastify Backend / Node.js 24] (PM2 Cluster on PORT 5002)
       │
       ├─ Direct /api/ routes
       ├─ Real-time WebSocket: /api/ws
       └─ Static Vite SPA serving: /var/www/mmsv2/apps/frontend/dist
```

---

## 2. Apache Virtual Host Configuration (`mmsv2.conf`)

Located at `/etc/apache2/sites-available/mmsv2.conf`:

```apache
<VirtualHost *:443>
    ServerName mmsv2.example.com
    ServerAlias *.mmsv2.example.com

    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/mmsv2.example.com/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/mmsv2.example.com/privkey.pem

    # Proxy to Fastify backend
    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:5002/
    ProxyPassReverse / http://127.0.0.1:5002/

    # WebSocket Upgrade
    RewriteEngine on
    RewriteCond %{HTTP:Upgrade} websocket [NC]
    RewriteCond %{HTTP:Connection} upgrade [NC]
    RewriteRule ^/?(.*) "ws://127.0.0.1:5002/$1" [P,L]
</VirtualHost>
```

---

## 3. Deployment & Zero-Downtime Rollback

### Deploying a Release:
1. CI builds and publishes `mms-dist.tar.gz` artifact.
2. Server script unpacks artifact to `/var/www/mmsv2/releases/${DEPLOY_SHA}`.
3. Symlink `/var/www/mmsv2/current` is atomically updated.
4. PM2 performs graceful zero-downtime reload:
   ```bash
   pm2 reload mmsv2 --update-env
   ```

### Emergency Rollback:
If an outage or critical regression occurs:
```bash
# List available release SHAs
bash scripts/deploy-rollback.sh list

# Rollback to specific known-good release
bash scripts/deploy-rollback.sh <previous-commit-sha>
```
Note: Applied database migrations remain in place. All DDL must adhere to the expand/contract standard so release N-1 functions against release N schema.
