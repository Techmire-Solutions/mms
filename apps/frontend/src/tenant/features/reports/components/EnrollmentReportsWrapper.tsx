import { useTranslation } from "@/hooks/useTranslation";
import { EnrollmentReports } from "@/tenant/components/reports/moduleReportAdapters";
import { useEnrollmentsReportAggregates } from "@/tenant/hooks/collections/enrollments";
import { EMPTY_ENROLLMENTS_REPORT_AGGREGATES, type EnrollmentsReportAggregates } from "@mms/shared";
import { ErrorState } from "@/components/ui/ErrorState";
import type { ReportFilterFields } from "./ReportFilters";

export function EnrollmentReportsWrapper({
  filters,
}: {
  filters: ReportFilterFields;
}): React.JSX.Element {
  const { t } = useTranslation();
  const query = useEnrollmentsReportAggregates();

  const rawAggregates =
    query.data?.status === 200
      ? (query.data.body as EnrollmentsReportAggregates)
      : EMPTY_ENROLLMENTS_REPORT_AGGREGATES;

  const aggregates = (() => {
    let bySession = rawAggregates.bySession;
    if (filters.session && filters.session !== "all") {
      bySession = bySession.filter(
        (s) =>
          s.sessionId === filters.session || s.name.toLowerCase() === filters.session.toLowerCase(),
      );
    }
    return {
      ...rawAggregates,
      bySession,
    };
  })() as EnrollmentsReportAggregates;

  if (query.isError) {
    return (
      <ErrorState
        title={t("enrollments.loadFailed")}
        description={t("enrollments.loadFailedHint")}
        onRetry={() => void query.refetch()}
      />
    );
  }

  return <EnrollmentReports aggregates={aggregates} filters={filters} />;
}
