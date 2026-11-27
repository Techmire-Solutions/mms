import { StudentReportView } from "../../components/StudentReportView";
import PinnedWidgets from "./PinnedWidgets";
import { useStudentReportController } from "../hooks/useStudentReportController";
import type { StudentReportProps } from "../../components/studentReportTypes";

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
