# MMS WebSocket Real-Time Pipeline Architecture

This document details the real-time event distribution pipeline over `/api/ws`, cookie authentication mechanics, frame structures, and TanStack Query cache invalidation flows.

---

## 1. Connection Lifecycle & Authentication

The WebSocket pipeline provides low-latency, bidirectional event distribution between Fastify backend services and connected React client shells.

```
React Client                          Fastify Backend
     │                                      │
     │── GET /api/ws (Upgrade: websocket) ─►│
     │   Cookie: mms_tenant_session         │  (authenticateTenant middleware)
     │                                      │  Verify session & extract tenantId
     │◄── 101 Switching Protocols ──────────│
     │                                      │
     │◄── { type: "connected", ... } ───────│  Register socket in TenantSocketMap
     │                                      │
```

- **Endpoint:** `apps/backend/src/routes/common/websocket.ts`
- **Authentication:** Authenticated via standard session cookies (`mms_tenant_session`). Bearer tokens in URL query strings are strictly prohibited to prevent credential leaks in access logs.
- **Tenant Isolation:** Sockets are indexed by `tenantId`. Broadcasts are scoped to the originating workspace unless explicitly addressed to a system-wide platform operator.

---

## 2. Message Frame Specification

All frames exchanged over `/api/ws` use standard JSON serialization:

### Event Distribution Frame
```json
{
  "type": "database_update",
  "tenantId": "ws-demo",
  "payload": {
    "entity": "students",
    "action": "create",
    "id": "std_1024",
    "timestamp": 1729040000000
  }
}
```

### Background Job Progress Frame
```json
{
  "type": "job_progress",
  "tenantId": "ws-demo",
  "payload": {
    "jobId": "job_export_991",
    "progress": 75,
    "status": "processing",
    "stage": "Generating PDF layout"
  }
}
```

---

## 3. Frontend Client Integration

Frontend subscription is managed via `apps/frontend/src/lib/tenantWebSocket.ts`:

- **Singleton Manager:** `TenantWebSocketManager` maintains a single active WebSocket connection per authenticated tenant session.
- **Heartbeat & Reconnect:** Exponential backoff with jitter on disconnect (initial delay 500ms, cap 30s).
- **TanStack Query Invalidation Mapping:**
  ```typescript
  import { queryClient } from '@/lib/queryClient';

  function handleDatabaseUpdate(event: DatabaseUpdateEvent) {
    const { entity, id } = event.payload;
    // Invalidate list queries for the entity
    queryClient.invalidateQueries({ queryKey: [entity, 'list'] });
    // Invalidate specific entity detail query if targeted
    if (id) {
      queryClient.invalidateQueries({ queryKey: [entity, 'detail', id] });
    }
  }
  ```

---

## 4. Verification

```bash
# Test Fastify WebSocket route injection
pnpm --filter mms-backend test apps/backend/src/__tests__/websocketRoute.test.ts

# Test Frontend WebSocket client manager
pnpm --filter mms-frontend test apps/frontend/src/lib/tenantWebSocket.test.ts
```
