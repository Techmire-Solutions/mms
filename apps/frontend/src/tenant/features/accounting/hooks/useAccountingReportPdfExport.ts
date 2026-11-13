import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AccountingReportPdfBody, BackgroundJobRecord } from "@mms/shared";
import { apiContract } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import { notify } from "@/lib/notify";
import { useTranslation } from "@/hooks/useTranslation";
import { BACKGROUND_JOBS_QUERY_KEY } from "@/tenant/hooks/useBackgroundJobs";

/**
 * Queues a BiDi-correct statement PDF on the server.
 *
 * The client-side jsPDF path cannot shape Arabic/Urdu/Farsi or lay a table out RTL,
 * so report PDFs are rendered by the worker's Typst engine and delivered through the
 * background-jobs tray (progress + download), exactly like other module exports.
 */
export function useAccountingReportPdfExport(): {
  queuePdf: (body: AccountingReportPdfBody) => Promise<BackgroundJobRecord | null>;
  isQueuing: boolean;
} {
  const { t, language } = useTranslation();
  const queryClient = useQueryClient();
  const [isQueuing, setIsQueuing] = useState(false);

  const queuePdf = useCallback(
    async (body: AccountingReportPdfBody) => {
      setIsQueuing(true);
      try {
        const response = await apiContract.accounting.requestReportPdf({
          body: {
            ...body,
            lang: body.lang ?? (language as AccountingReportPdfBody["lang"]),
            direction: body.direction ?? (language === "en" ? "ltr" : "rtl"),
          },
        });
        if (response.status !== 202) {
          const errorBody = response.body as { message?: string; type?: string } | undefined;
          throw new ApiError(
            response.status,
            errorBody?.message ?? "Failed to queue the report PDF",
            errorBody?.type,
          );
        }
        const { job } = response.body as { job: BackgroundJobRecord };
        notify.success(t("accounting.reports.pdfQueued"));
        void queryClient.invalidateQueries({ queryKey: BACKGROUND_JOBS_QUERY_KEY });
        return job;
      } catch (error) {
        notify.error(error instanceof Error ? error.message : String(error));
        return null;
      } finally {
        setIsQueuing(false);
      }
    },
    [language, queryClient, t],
  );

  return { queuePdf, isQueuing };
}
