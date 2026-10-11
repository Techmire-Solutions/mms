import { tsrClient } from "@/lib/api";
import { useAuth } from "@/lib/contexts/AuthContext";
import type { Contact } from "@mms/shared";

export const TENANT_PROFILE_KEY = ["tenant", "profile"] as const;

/** Own-account profile payload: user flags plus the linked Contact record. */
export interface TenantProfileData {
  name?: string;
  phone?: string;
  email?: string;
  emailVerifiedAt?: string | null;
  contact?: Contact | null;
  [key: string]: unknown;
}

export function useTenantProfile(enabled = true) {
  const { isAuthenticated } = useAuth();

  return tsrClient.profile.getProfile.useQuery({
    queryKey: TENANT_PROFILE_KEY,
    enabled: isAuthenticated && enabled,
    staleTime: 30_000,
    select: (data: unknown) =>
      (data as { body?: { profile?: TenantProfileData } } | null)?.body?.profile,
  });
}
