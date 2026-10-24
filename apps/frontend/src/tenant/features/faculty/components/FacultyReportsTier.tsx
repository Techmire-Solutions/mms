import type React from "react";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";
import { ErrorState } from "@/components/app/ErrorState";
import { ModuleTierMotion } from "@/components/app/ModuleTierMotion";
import { useTranslation } from "@/hooks/useTranslation";
import { KPISummary, ModuleReports } from "@/tenant/components/moduleReports";
import { useFacultyMetrics } from "@/tenant/features/faculty/hooks/useFaculty";

export function FacultyReportsTier(): React.JSX.Element {
  const { t } = useTranslation();
  const metricsQuery = useFacultyMetrics();

  return (
    <ModuleTierMotion tier="reports" className="space-y-4">
      <ErrorBoundary>
        {metricsQuery.isError ? (
          <ErrorState
            title={t("faculty.report.loadFailed")}
            description={t("faculty.report.loadFailedHint")}
            onRetry={() => void metricsQuery.refetch()}
          />
        ) : (
          <>
            <KPISummary category="faculty" />
            <ModuleReports category="faculty" />
          </>
        )}
      </ErrorBoundary>
    </ModuleTierMotion>
  );
}

export default FacultyReportsTier;
