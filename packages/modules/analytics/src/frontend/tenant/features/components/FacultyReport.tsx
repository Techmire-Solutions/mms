import { FacultyReportView } from "../../components/FacultyReportView";
import PinnedWidgets from "./PinnedWidgets";
import { useFacultyReportController } from "../hooks/useFacultyReportController";
import type { FacultyReportProps } from "../../components/facultyReportTypes";

export default function FacultyReport({ filters }: FacultyReportProps): React.JSX.Element {
  const report = useFacultyReportController({ filters });
  return <FacultyReportView report={report} widgets={<PinnedWidgets category="faculty" />} />;
}
