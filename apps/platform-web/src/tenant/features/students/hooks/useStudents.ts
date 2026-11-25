export type { StudentRecord } from "@/tenant/features/students/hooks/studentsQueryKeys";

export {
  STUDENTS_QUERY_KEY,
  STUDENTS_METRICS_QUERY_KEY,
  STUDENTS_WIDGET_AGGREGATES_QUERY_KEY,
} from "@/tenant/features/students/hooks/studentsQueryKeys";

export { useStudentMutations } from "@/tenant/features/students/hooks/useStudentMutations";

export {
  fetchAllStudentsForQuery,
  useStudentLinkedContactIds,
  useStudentNextGrNumber,
  checkStudentRegistrationDuplicate,
  studentsCommandMetricsQueryOptions,
  useStudentsMetrics,
  useStudentsByIds,
  useStudentsWidgetAggregates,
} from "@/tenant/features/students/hooks/useStudentsQueries";
