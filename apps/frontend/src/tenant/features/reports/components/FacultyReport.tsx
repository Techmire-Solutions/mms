import { FacultyReportView } from "@/components/ui/reports/FacultyReportView";
import PinnedWidgets from "@/tenant/features/reports/components/PinnedWidgets";
import { useFacultyReportController } from "../controllers/useFacultyReportController";
import type { FacultyReportProps } from "@/components/ui/reports/facultyReportTypes";

export default function FacultyReport({ filters }: FacultyReportProps): React.JSX.Element {
  const report = useFacultyReportController({ filters });
  return <FacultyReportView report={report} widgets={<PinnedWidgets category="faculty" />} />;
}
