import type React from "react";
import { ErrorBoundary } from "@mms/fe-core/components/ErrorBoundary";
import { ErrorState } from "@mms/fe-core/components/ErrorState";
import { ModuleTierMotion } from "@mms/ui/app/ModuleTierMotion";
import { useTranslation } from "@mms/fe-core/i18n";
import { KPISummary, ModuleReports } from "../host/moduleReports";
import { useFacultyMetrics } from "../hooks/useFaculty";

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
