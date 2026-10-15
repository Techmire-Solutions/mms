import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { MutateOptions } from "@tanstack/react-query";
import type {
  Account,
  JournalEntry,
  FiscalYear,
  SpecializedEntryInput,
  SpecializedEntryResult,
} from "@mms/shared";
import { ACCOUNTING_MODULE_MANIFEST, FINANCE_MODULE_MANIFEST } from "@mms/shared";
import { apiContract, tsrClient } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import { invalidateAccountingQueries } from "./invalidateAccountingQueries";

export function useAccountingMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    invalidateAccountingQueries(queryClient);
  };

  const upsertAccounts = tsrClient.accounting.upsertAccounts.useMutation({ onSuccess: invalidate });
  const upsertEntries = tsrClient.accounting.upsertEntries.useMutation({ onSuccess: invalidate });
  const upsertFiscalYears = tsrClient.accounting.upsertFiscalYears.useMutation({
    onSuccess: invalidate,
  });
  const deleteEntry = tsrClient.accounting.deleteEntry.useMutation({ onSuccess: invalidate });
  const restoreEntry = tsrClient.accounting.restoreEntry.useMutation({ onSuccess: invalidate });
  const bulkDeleteEntries = tsrClient.accounting.bulkDeleteEntries.useMutation({
    onSuccess: invalidate,
  });
  const bulkRestoreEntries = tsrClient.accounting.bulkRestoreEntries.useMutation({
    onSuccess: invalidate,
  });

  return {
    upsertAccounts: {
      ...upsertAccounts,
      mutate: (accounts: Account[], opts?: MutateOptions) =>
        upsertAccounts.mutate({ body: accounts }, opts),
      mutateAsync: (accounts: Account[]) => upsertAccounts.mutateAsync({ body: accounts }),
    },
    upsertEntries: {
      ...upsertEntries,
      mutate: (entries: JournalEntry[], opts?: MutateOptions) =>
        upsertEntries.mutate({ body: entries }, opts),
      mutateAsync: (entries: JournalEntry[]) => upsertEntries.mutateAsync({ body: entries }),
    },
    upsertFiscalYears: {
      ...upsertFiscalYears,
      mutate: (fiscalYears: FiscalYear[], opts?: MutateOptions) =>
        upsertFiscalYears.mutate({ body: fiscalYears }, opts),
      mutateAsync: (fiscalYears: FiscalYear[]) =>
        upsertFiscalYears.mutateAsync({ body: fiscalYears }),
    },
    deleteEntry: {
      ...deleteEntry,
      mutate: (id: string, opts?: MutateOptions) => deleteEntry.mutate({ params: { id } }, opts),
      mutateAsync: (id: string) => deleteEntry.mutateAsync({ params: { id } }),
    },
    restoreEntry: {
      ...restoreEntry,
      mutate: (id: string, opts?: MutateOptions) => restoreEntry.mutate({ params: { id } }, opts),
      mutateAsync: (id: string) => restoreEntry.mutateAsync({ params: { id } }),
    },
    bulkDeleteEntries: {
      ...bulkDeleteEntries,
      mutate: (ids: string[], opts?: MutateOptions) =>
        bulkDeleteEntries.mutate({ body: { ids } }, opts),
      mutateAsync: (ids: string[]) => bulkDeleteEntries.mutateAsync({ body: { ids } }),
    },
    bulkRestoreEntries: {
      ...bulkRestoreEntries,
      mutate: (ids: string[], opts?: MutateOptions) =>
        bulkRestoreEntries.mutate({ body: { ids } }, opts),
      mutateAsync: (ids: string[]) => bulkRestoreEntries.mutateAsync({ body: { ids } }),
    },
  };
}

/**
 * Fee/Salary quick-action mutation — bridges Finance and Accounting in one
 * backend transaction; both modules' cached data are invalidated on success.
 */
export function useProcessSpecializedEntryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SpecializedEntryInput) => {
      const response = await apiContract.accountingLedger.processSpecializedEntry({ body: input });
      if (response.status < 200 || response.status >= 300) {
        const errorBody = response.body as { message?: string; type?: string } | undefined;
        throw new ApiError(
          response.status,
          errorBody?.message ?? "Failed to process specialized entry",
          errorBody?.type,
        );
      }
      return response.body as SpecializedEntryResult;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [ACCOUNTING_MODULE_MANIFEST.moduleId] });
      void queryClient.invalidateQueries({ queryKey: [FINANCE_MODULE_MANIFEST.moduleId] });
    },
  });
}
