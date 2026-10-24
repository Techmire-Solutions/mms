import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/contexts/AuthContext";
import { tsrClient } from "@/lib/api";
import { CONTACTS_GOOGLE_SYNC_QUERY_KEY } from "@/tenant/features/contacts/hooks/contactsQueryKeys";

export function useContactGoogleSyncConfig(options?: { enabled?: boolean }) {
  const { isAuthenticated } = useAuth();
  const enabled = options?.enabled ?? true;

  return tsrClient.contacts.getGoogleSyncConfig.useQuery({
    queryKey: CONTACTS_GOOGLE_SYNC_QUERY_KEY,
    queryData: {},
    enabled: isAuthenticated && enabled,
    staleTime: 60_000,
  });
}

export function useContactGoogleSyncMutations() {
  const queryClient = useQueryClient();
  const saveConfig = tsrClient.contacts.updateGoogleSyncConfig.useMutation({
    onSuccess: (res: { status: number; body?: { config?: unknown } }) => {
      if (res.status === 200 && res.body?.config) {
        queryClient.setQueryData(CONTACTS_GOOGLE_SYNC_QUERY_KEY, res.body.config);
      }
    },
  });
  const logSyncAudit = tsrClient.contacts.logGoogleSyncAudit.useMutation();
  const exchangeOAuth = tsrClient.contacts.exchangeGoogleSyncOAuth.useMutation({
    onSuccess: (res: { status: number; body?: { config?: unknown } }) => {
      if (res.status === 200 && res.body?.config) {
        queryClient.setQueryData(CONTACTS_GOOGLE_SYNC_QUERY_KEY, res.body.config);
      }
    },
  });
  const runGoogleSync = tsrClient.contacts.runGoogleSync.useMutation();

  return { saveConfig, logSyncAudit, exchangeOAuth, runGoogleSync };
}
