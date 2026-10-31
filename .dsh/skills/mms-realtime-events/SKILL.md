---
name: mms-realtime-events
description: Implements and maintains WebSocket real-time event distribution over /api/ws, event multiplexing, and client TanStack Query cache invalidation. Use when dispatching live update events from backend services, adding websocket channels, or subscribing to realtime updates in frontend hooks. Do NOT use for standard HTTP REST polling (use mms-query-factories), background job worker execution (use mms-background-jobs), or SMS/WhatsApp messaging (use mms-messaging).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-16
---

# MMS Real-Time Events & WebSocket Architecture

**Rules (norms SSOT):** `mms-api-interface.md` (route contracts) · `mms-data-layer.md` §3 (Query cache authority) · `mms-performance.md` §2 (lean payloads & push invalidation).

## When to use

- Dispatching live push events after backend data mutations or state changes
- Maintaining `/api/ws` Fastify WebSocket connection lifecycle, authentication, or multiplexing
- Subscribing to database updates in React client hooks via `useTenantDatabaseUpdates`
- Broadcasting BullMQ background job completion, export readiness, or outbox CDC events

## 1. WebSocket Protocol & Authentication

MMS uses a singular cookie-authenticated WebSocket endpoint (`/api/ws`):
- **Handshake & Auth**: Authenticated via the tenant session cookie (`mms_tenant_session`) during the HTTP upgrade. The connection is automatically bound to the tenant workspace (`subdomain`).
- **Connection Isolation**: Sockets are tracked per tenant workspace in `apps/backend/src/lib/livePush.ts`. Clients never receive events or payload broadcasts across tenant boundaries.
- **Heartbeat & Reconnect**: The frontend client `tenantWebSocket.ts` implements exponential backoff reconnection and ping/pong heartbeats to keep the connection alive through reverse proxies.

## 2. Event Types & Cache Invalidation

Instead of pushing heavy entity payloads over WebSocket, MMS sends lightweight event descriptors that trigger targeted TanStack Query key invalidations:

| Event Type | Payload Shape | Client Handler Action |
|---|---|---|
| `database_update` | `{ collection: string, action: 'insert'\|'update'\|'delete', id?: string }` | Invalidates matching collection query keys in `useTenantDatabaseUpdates.ts` |
| `job_progress` | `{ jobId: string, type: string, progress: number, status: string }` | Updates background job tray state |
| `notification` | `{ id: string, title: string, level: 'info'\|'warning'\|'error' }` | Triggers toast or updates bell notification count |

### Dispatching Events from Backend Services
```typescript
import { broadcastToTenant } from '../lib/livePush.js';

// After successful database transaction
await broadcastToTenant(tenantSubdomain, {
  type: 'database_update',
  collection: 'students',
  action: 'insert',
  id: studentId,
});
```

## 3. Implementation Map

| Layer | Path |
|---|---|
| Backend WS Route | `apps/backend/src/routes/common/websocket.ts` |
| Backend Live Push Dispatcher | `apps/backend/src/lib/livePush.ts` |
| Frontend WS Client | `apps/frontend/src/lib/tenantWebSocket.ts` |
| Query Invalidation Hook | `apps/frontend/src/hooks/useTenantDatabaseUpdates.ts` |
| Integration Suite | `apps/backend/src/__tests__/websocketRoute.test.ts` |

## 4. Verification

```bash
pnpm --filter mms-backend test apps/backend/src/__tests__/websocketRoute.test.ts
pnpm --filter mms-frontend test apps/frontend/src/lib/tenantWebSocket.test.ts
```

## References

- WebSocket Real-Time Pipeline Architecture: `references/websocket-pipeline.md`

## Related skills

`mms-query-factories`, `mms-backend-api`, `mms-background-jobs`, `mms-frontend`.
