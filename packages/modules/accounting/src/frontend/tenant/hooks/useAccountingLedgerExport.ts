import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AccountingLedgerExportBody, BackgroundJobRecord } from "@mms/contracts";
import { apiContract } from "@mms/fe-core/api/tsRest";
import { ApiError } from "@mms/fe-core/api/client";
import { notify } from "@mms/fe-core/notify";
import { useTranslation } from "@mms/fe-core/i18n";
import { BACKGROUND_JOBS_QUERY_KEY } from "@mms/fe-core/backgroundJobs";

/**
 * Queues the full journal-register CSV on the server.
 *
 * The on-screen export only covers the page the browser already holds; this asks the
 * worker to stream the whole register (keyset pages → blob storage) for the tray.
 */
export function useAccountingLedgerExport(): {
  queueLedgerExport: (body: AccountingLedgerExportBody) => Promise<BackgroundJobRecord | null>;
  isQueuing: boolean;
} {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isQueuing, setIsQueuing] = useState(false);

  const queueLedgerExport = useCallback(
    async (body: AccountingLedgerExportBody) => {
      setIsQueuing(true);
      try {
        const response = await apiContract.accounting.exportLedger({ body });
        if (response.status !== 202) {
          const errorBody = response.body as { message?: string; type?: string } | undefined;
          throw new ApiError(
            response.status,
            errorBody?.message ?? "Failed to queue the ledger export",
            errorBody?.type,
          );
        }
        const { job } = response.body as { job: BackgroundJobRecord };
        notify.success(t("accounting.ledger.exportQueued"));
        void queryClient.invalidateQueries({ queryKey: BACKGROUND_JOBS_QUERY_KEY });
        return job;
      } catch (error) {
        notify.error(error instanceof Error ? error.message : String(error));
        return null;
      } finally {
        setIsQueuing(false);
      }
    },
    [queryClient, t],
  );

  return { queueLedgerExport, isQueuing };
}
