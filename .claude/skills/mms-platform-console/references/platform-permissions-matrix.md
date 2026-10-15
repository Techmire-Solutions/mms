# Platform Apex Permissions & Capabilities Matrix

Defines platform apex administrative capabilities, distinct from tenant workspace RBAC.

## 1. Platform Permission Keys

Defined in `@mms/shared` and configured in `apps/frontend/src/platform/lib/platformPermissionConfig.ts`:

| Permission Key | Scope | Typical Admin Action |
|---|---|---|
| `workspaces` | Workspace Management | List, inspect, suspend, or configure tenant workspaces |
| `onboard` | Tenant Provisioning | Provision new workspaces, seed initial schemas, onboard founders |
| `settings` | Apex Platform Settings | Platform email/SMS gateway configuration, billing plans |
| `admins` | Platform Staff & RBAC | Manage platform admin users and assign platform permission sets |
| `system` | Health & System Operations | Node diagnostics, database metrics, audit partitions, worker status |

## 2. Frontend Permission Checking

In Platform Console components:
```typescript
import { usePlatformAuth } from '../lib/PlatformAuthContext.js';

const { user, can } = usePlatformAuth();

// Check platform capability
if (can('workspaces')) {
  // Render workspace management controls
}
```

## 3. Backend Fastify Route Gating

In platform route modules (`apps/backend/src/routes/platform/`):
```typescript
import { authenticatePlatform } from '../../middleware/authenticatePlatform.js';

fastify.post('/api/platform/workspaces', {
  preHandler: [authenticatePlatform],
  handler: async (request, reply) => {
    // Assert required permission on platform user
    if (!request.platformUser?.permissions.includes('onboard')) {
      return reply.status(403).send({ type: 'forbidden', message: 'Missing onboard permission' });
    }
    // Proceed with provisioning
  },
});
```
