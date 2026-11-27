import type { Contact } from "@mms/contracts";

/** Own-profile cache key carries the `auth` segment so it is never persisted to IndexedDB. */
export const TENANT_PROFILE_KEY = ["auth", "tenant", "profile"] as const;

/** Own-account profile payload: user flags plus the linked Contact record. */
export interface TenantProfileData {
  name?: string;
  phone?: string;
  email?: string;
  emailVerifiedAt?: string | null;
  contact?: Contact | null;
  [key: string]: unknown;
}
