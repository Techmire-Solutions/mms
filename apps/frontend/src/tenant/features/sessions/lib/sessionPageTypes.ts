import type {
  SessionLifecycleState,
  SessionSortField as SharedSessionSortField,
} from "@mms/shared";

/** Shared lifecycle union (legacy persisted aliases normalize to this on the server). */
export type SessionStatus = SessionLifecycleState;
/** Tenant-managed program/type display name (not a closed enum). */
export type SessionType = string;
export type SessionSortField = SharedSessionSortField;
