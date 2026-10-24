---
name: mms-notifications
description: Governs in-app notification center, real-time unread count badges, notification preferences, and event-driven alert triggers. Use when modifying NotificationsPage, in-app notification delivery, read receipts, or notification badge UI. Do NOT use for external SMS/WhatsApp marketing campaigns (use mms-messaging), generic transient UI toasts (use notify.* in mms-ui-ux-design), or background email jobs (use mms-background-jobs).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-16
---

# MMS In-App Notifications & Alerts

**Rules (norms SSOT):** `mms-ui-ux-design.mdc` §1 (toasts vs in-app notifications) · `mms-api-interface.mdc` · `mms-core.mdc`.

## When to use

- Building or modifying the in-app notification center or `NotificationsPage.tsx`
- Wiring real-time unread badge counts in the navigation header
- Implementing mark-as-read, mark-all-read, and deep-link click-through handlers
- Configuring user notification preferences or event-driven alert triggers

## 1. Domain Invariants & Architecture

- **In-App vs Toasts**: Transient feedback for immediate user actions uses `notify.*` toasts (`packages/ui/src`). Persistent asynchronous events, reminders, and background job completions use the in-app notification system.
- **WebSocket Invalidation**: When a notification is generated on the backend, push an invalidation message over `/api/ws` (`mms-realtime-events`) to invalidate the unread count query key immediately.
- **Deep-Link Navigation**: Every notification specifies a `target` payload identifying the destination entity and ID. Clicking a notification marks it as read and executes `useOpenTenantNotification()`.
- **Tenant Isolation**: Notifications are strictly scoped to the active tenant workspace (`app.current_tenant`) and target user ID.

## 2. Implementation Map

| Surface | Path |
|---------|------|
| Notifications Page | `apps/frontend/src/tenant/features/notifications/NotificationsPage.tsx` |
| Notification Row | `apps/frontend/src/tenant/features/notifications/components/NotificationsPageRow.tsx` |
| Notifications Hook | `apps/frontend/src/tenant/hooks/notifications/useTenantNotifications.ts` |
| Target Navigator | `apps/frontend/src/tenant/hooks/notifications/useOpenTenantNotification.ts` |

## 3. Verification Checklist

```
- [ ] NotificationsPage renders with semantic header and empty-state handling
- [ ] Unread badge displays accessible polite status (aria-live="polite")
- [ ] Clicking a row marks it read and navigates to the target entity
- [ ] Mark all read button disables when unreadCount === 0
- [ ] WebSocket channel invalidates notifications cache on new events
- [ ] Verify: pnpm typecheck && pnpm --filter mms-frontend lint
```

## Related skills

`mms-realtime-events`, `mms-messaging`, `mms-module-page`, `mms-ui-ux-design`, `mms-frontend`.
