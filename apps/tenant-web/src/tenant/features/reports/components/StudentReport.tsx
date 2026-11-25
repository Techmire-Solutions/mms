import { StudentReportView } from "@/components/reports/StudentReportView";
import PinnedWidgets from "@/tenant/features/reports/components/PinnedWidgets";
import { useStudentReportController } from "../hooks/useStudentReportController";
import type { StudentReportProps } from "@/components/reports/studentReportTypes";

export default function StudentReport({ filters }: StudentReportProps): React.JSX.Element {
  const report = useStudentReportController({ filters });
  return (
    <StudentReportView
      report={{
        ...report,
        historyTotal: report.enrollmentsPageQuery.data?.total ?? 0,
        historyHasMore: report.enrollmentsPageQuery.data?.hasMore ?? false,
        retryHistory: () => {
          void report.enrollmentsPageQuery.refetch();
        },
      }}
      widgets={<PinnedWidgets category="students" />}
    />
  );
}
