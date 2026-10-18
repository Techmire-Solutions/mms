/**
 * Messaging Query keys are owned by `@/hooks/useMessaging` (next to the hooks that
 * declare them), so the invalidator lives there and is re-exported here for the
 * feature's cross-module public surface.
 */
export { invalidateMessagingQueries } from "@/hooks/useMessaging";
