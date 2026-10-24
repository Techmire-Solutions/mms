import { useCallback } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import {
  journalEntryListSchema,
  type Account,
  type AppTranslationKey,
  type FiscalYear,
  type JournalEntry,
} from "@mms/shared";
import { useAccountingMutations } from "@/tenant/features/accounting/hooks/useAccountingApi";
import { NotifiedMutationError } from "@/lib/notifiedMutationError";
import { getApiValidationMessage } from "@/lib/apiValidationMessage";

/**
 * Human-readable reason for a failed write.
 *
 * The ts-rest React Query hooks do NOT reject with an `Error`: they
 * `throw result` (see `@ts-rest/react-query` `create-hooks`: `if
 * (isErrorResponse(result)) throw result;`), i.e. the raw `{ status, body,
 * headers }` object. `String(error)` therefore rendered every accounting
 * refusal — closed fiscal year, posted-entry immutability, unknown/archived
 * account, unbalanced posted write — as the literal text "[object Object]".
 * {@link getApiValidationMessage} already knows that shape and unwraps the
 * server's own message, which is what the bookkeeper needs to read.
 */
function describeActionFailure(error: unknown): string | undefined {
  const apiMessage = getApiValidationMessage(error);
  if (apiMessage) return apiMessage;
  if (error instanceof Error && error.message.trim()) return error.message;
  return undefined;
}

interface UseAccountingPageActionsParams {
  accounts: Account[];
  journalEntries: JournalEntry[];
  fiscalYears: FiscalYear[];
}

export function useAccountingPageActions({
  accounts,
  journalEntries,
  fiscalYears,
}: UseAccountingPageActionsParams) {
  const { t } = useTranslation();
  const {
    upsertAccounts,
    upsertEntries,
    upsertFiscalYears,
    deleteEntry,
    restoreEntry,
    bulkDeleteEntries,
    bulkRestoreEntries,
  } = useAccountingMutations();

  const notifyActionFailure = useCallback(
    (messageKey: AppTranslationKey, error: unknown) => {
      if (error instanceof NotifiedMutationError) return;
      const description = describeActionFailure(error);
      notify.error(t(messageKey), description ? { description } : undefined);
    },
    [t],
  );

  const notifySaveFailure = useCallback(
    (error: unknown) => {
      notifyActionFailure("accounting.settings.saveEntriesFailed", error);
    },
    [notifyActionFailure],
  );

  const setAccounts = async (updater: Account[] | ((prev: Account[]) => Account[])) => {
    const nextAccounts = typeof updater === "function" ? updater(accounts) : updater;
    try {
      await upsertAccounts.mutateAsync(nextAccounts);
    } catch (error: unknown) {
      notifySaveFailure(error);
      throw error;
    }
  };

  /** Resolves with the server's copy so callers can show server-assigned voucher numbers. */
  const setEntries = async (
    updater: JournalEntry[] | ((prev: JournalEntry[]) => JournalEntry[]),
  ): Promise<JournalEntry[]> => {
    const nextJournalEntries = typeof updater === "function" ? updater(journalEntries) : updater;
    try {
      const result: unknown = await upsertEntries.mutateAsync(nextJournalEntries);
      const saved = journalEntryListSchema.safeParse(
        result &&
          typeof result === "object" &&
          "body" in result &&
          result.body &&
          typeof result.body === "object" &&
          "entries" in result.body
          ? result.body.entries
          : undefined,
      );
      return saved.success ? saved.data : nextJournalEntries;
    } catch (error: unknown) {
      notifySaveFailure(error);
      throw error;
    }
  };

  const setFiscalYears = async (updater: FiscalYear[] | ((prev: FiscalYear[]) => FiscalYear[])) => {
    const nextFiscalYears = typeof updater === "function" ? updater(fiscalYears) : updater;
    try {
      await upsertFiscalYears.mutateAsync(nextFiscalYears);
    } catch (error: unknown) {
      notifySaveFailure(error);
      throw error;
    }
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      await deleteEntry.mutateAsync(id);
      notify.success(t("accounting.trash.deleted"));
    } catch (error: unknown) {
      notifyActionFailure("accounting.trash.actionFailed", error);
      throw error;
    }
  };

  const handleRestoreEntry = async (id: string) => {
    try {
      await restoreEntry.mutateAsync(id);
      notify.success(t("accounting.trash.restored"));
    } catch (error: unknown) {
      notifyActionFailure("accounting.trash.actionFailed", error);
      throw error;
    }
  };

  const handleBulkDeleteEntries = async (ids: string[]) => {
    try {
      const result = await bulkDeleteEntries.mutateAsync(ids);
      if (result.failed > 0) {
        notify.warning(
          t("accounting.trash.bulkPartial", {
            succeeded: result.succeeded,
            failed: result.failed,
          }),
        );
      } else {
        notify.success(
          result.succeeded > 1
            ? t("accounting.trash.bulkDeleted", { count: result.succeeded })
            : t("accounting.trash.deleted"),
        );
      }
    } catch (error: unknown) {
      notifyActionFailure("accounting.trash.actionFailed", error);
      throw error;
    }
  };

  const handleBulkRestoreEntries = async (ids: string[]) => {
    try {
      const result = await bulkRestoreEntries.mutateAsync(ids);
      if (result.failed > 0) {
        notify.warning(
          t("accounting.trash.bulkPartial", {
            succeeded: result.succeeded,
            failed: result.failed,
          }),
        );
      } else {
        notify.success(
          result.succeeded > 1
            ? t("accounting.trash.bulkRestored", { count: result.succeeded })
            : t("accounting.trash.restored"),
        );
      }
    } catch (error: unknown) {
      notifyActionFailure("accounting.trash.actionFailed", error);
      throw error;
    }
  };

  return {
    setAccounts,
    setEntries,
    setFiscalYears,
    handleDeleteEntry,
    handleRestoreEntry,
    handleBulkDeleteEntries,
    handleBulkRestoreEntries,
  };
}
