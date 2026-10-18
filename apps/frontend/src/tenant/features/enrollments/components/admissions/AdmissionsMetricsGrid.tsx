import React from "react";
import { Clock3, Inbox, UserCheck, Users } from "lucide-react";
import { ModuleCommandMetricsGrid } from "@/components/app/ModuleCommandMetricsGrid";
import { useTranslation } from "@/hooks/useTranslation";
import { useAdmissionsMetrics } from "@/tenant/features/enrollments/hooks/useAdmissions";

/** Admissions funnel KPIs from the server `/metrics` endpoint. */
export function AdmissionsMetricsGrid({ sessionId }: { sessionId?: string }): React.JSX.Element {
  const { t } = useTranslation();
  const m = useAdmissionsMetrics(sessionId).data;
  return (
    <ModuleCommandMetricsGrid
      items={[
        {
          key: "submitted",
          icon: Inbox,
          label: t("enrollments.admissions.metric.submitted"),
          value: m?.submitted ?? 0,
        },
        {
          key: "review",
          icon: Clock3,
          label: t("enrollments.admissions.metric.underReview"),
          value: m?.underReview ?? 0,
          accent: "warning",
        },
        {
          key: "waitlisted",
          icon: Users,
          label: t("enrollments.admissions.metric.waitlisted"),
          value: m?.waitlisted ?? 0,
        },
        {
          key: "enrolled",
          icon: UserCheck,
          label: t("enrollments.admissions.metric.enrolled"),
          value: m?.enrolled ?? 0,
          accent: "success",
        },
      ]}
    />
  );
}
