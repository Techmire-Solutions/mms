import { useQueryClient } from "@tanstack/react-query";
import type {
  ContactColumnPreference,
  ContactsSavedReport,
  ContactsSavedReportShareScope,
  ContactsWorkDrillDown,
} from "@mms/shared";
import { clampModuleColumnWidth } from "@mms/shared";
import { useAuth } from "@/lib/contexts/AuthContext";
import { tsrClient } from "@/lib/api";
import {
  CONTACT_COLUMN_PREFERENCES_QUERY_KEY,
  CONTACTS_SAVED_REPORTS_QUERY_KEY,
} from "@/tenant/features/contacts/hooks/contactsQueryKeys";
import type { SavedReportsSource } from "@/hooks/useSavedReportsSource";

interface ContactsSavedReportCreateInput {
  name: string;
  drillDown: ContactsWorkDrillDown;
  shareScope?: ContactsSavedReportShareScope;
  sharedWithRoles?: string[];
  sharedWithUserIds?: string[];
}

export function useContactColumnPrefs(options?: { enabled?: boolean }) {
  const { isAuthenticated } = useAuth();
  const enabled = options?.enabled ?? true;

  const query = tsrClient.contacts.getColumnPreferences.useQuery({
    queryKey: CONTACT_COLUMN_PREFERENCES_QUERY_KEY,
    queryData: {},
    enabled: isAuthenticated && enabled,
    staleTime: 60_000,
  });

  const body = query.data?.body as { preferences?: ContactColumnPreference[] } | undefined;

  return {
    ...query,
    data:
      body?.preferences ??
      (Array.isArray(query.data) ? (query.data as ContactColumnPreference[]) : undefined),
  };
}

export function useContactColumnPrefsMutation() {
  const queryClient = useQueryClient();
  const mutation = tsrClient.contacts.updateColumnPreferences.useMutation({
    onSuccess: (response: { body?: { preferences?: ContactColumnPreference[] } }) => {
      queryClient.setQueryData(
        CONTACT_COLUMN_PREFERENCES_QUERY_KEY,
        response?.body?.preferences ?? [],
      );
    },
  });

  const sanitizePrefs = (rawPreferences: ContactColumnPreference[]) => {
    return rawPreferences
      .filter(
        (columnPreference) =>
          columnPreference &&
          typeof columnPreference.key === "string" &&
          columnPreference.key.trim().length > 0,
      )
      .map((columnPreference, index) => {
        const floored = Math.floor(
          typeof columnPreference.order === "number"
            ? columnPreference.order
            : Number(columnPreference.order),
        );
        const preference: ContactColumnPreference = {
          key: columnPreference.key.trim(),
          enabled: Boolean(columnPreference.enabled),
          order: Number.isSafeInteger(floored) && floored >= 0 ? floored : index,
        };
        if (typeof columnPreference.width === "number") {
          preference.width = clampModuleColumnWidth(columnPreference.width);
        }
        return preference;
      });
  };

  type RawPreferences =
    ContactColumnPreference[] | { body: { preferences: ContactColumnPreference[] } };

  const extractPrefs = (raw: RawPreferences): ContactColumnPreference[] =>
    Array.isArray(raw)
      ? raw
      : Array.isArray(
            (raw as { body: { preferences: ContactColumnPreference[] } }).body?.preferences,
          )
        ? (raw as { body: { preferences: ContactColumnPreference[] } }).body.preferences
        : [];

  return {
    ...mutation,
    mutate: (
      rawPreferences: RawPreferences,
      mutateOptions?: Parameters<typeof mutation.mutate>[1],
    ) => {
      return mutation.mutate(
        { body: { preferences: sanitizePrefs(extractPrefs(rawPreferences)) } },
        mutateOptions,
      );
    },
    mutateAsync: async (
      rawPreferences: RawPreferences,
      mutateOptions?: Parameters<typeof mutation.mutateAsync>[1],
    ) => {
      return mutation.mutateAsync(
        { body: { preferences: sanitizePrefs(extractPrefs(rawPreferences)) } },
        mutateOptions,
      );
    },
  };
}

function useContactsSavedReports() {
  const { isAuthenticated } = useAuth();

  return tsrClient.contacts.getSavedReports.useQuery({
    queryKey: CONTACTS_SAVED_REPORTS_QUERY_KEY,
    queryData: {},
    enabled: isAuthenticated,
    staleTime: 30_000,
  });
}

function useContactsSavedReportMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: CONTACTS_SAVED_REPORTS_QUERY_KEY });
  };

  const createSavedReport = tsrClient.contacts.createSavedReport.useMutation({
    onSuccess: invalidate,
  });

  const deleteSavedReport = tsrClient.contacts.deleteSavedReport.useMutation({
    onSuccess: invalidate,
  });

  const runSavedReport = tsrClient.contacts.runSavedReport.useMutation({
    onSuccess: invalidate,
  });

  return { createSavedReport, deleteSavedReport, runSavedReport };
}

export function useContactsSavedReportsSource(): SavedReportsSource<
  ContactsSavedReport,
  ContactsSavedReportCreateInput
> {
  const reportsQuery = useContactsSavedReports();
  const { createSavedReport, deleteSavedReport, runSavedReport } =
    useContactsSavedReportMutations();

  return {
    reports:
      (reportsQuery.data?.body as { reports?: ContactsSavedReport[] } | undefined)?.reports ?? [],
    isLoading: reportsQuery.isLoading,
    isError: reportsQuery.isError,
    retry: () => {
      void reportsQuery.refetch();
    },
    createReport: async (input) => {
      await createSavedReport.mutateAsync({ body: input });
    },
    deleteReport: async (id) => {
      await deleteSavedReport.mutateAsync({ params: { id } });
    },
    runReport: async (id) => {
      await runSavedReport.mutateAsync({ params: { id }, body: {} });
    },
  };
}
