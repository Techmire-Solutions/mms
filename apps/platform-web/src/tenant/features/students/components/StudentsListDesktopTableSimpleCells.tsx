import { calcAge, formatDate, type Student } from "@mms/contracts";
import { StatusBadge } from "@mms/fe-core/components/StatusBadge";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { StudentsListContentTableProps } from "@/tenant/features/students/lib/studentsListTypes";

/** DOB cell — age + formatted date. */
export function renderStudentDobCell({
  studentRow,
  emptyDash,
  t,
}: {
  studentRow: Student;
  emptyDash: string;
  t: TranslationFunction;
}): React.ReactNode {
  const age = calcAge(studentRow.dob);
  return (
    <>
      <p className="text-sm font-medium text-foreground">
        {age ? t("students.list.ageYears", { age }) : emptyDash}
      </p>
      <p className="text-xs text-muted-foreground">{formatDate(studentRow.dob, true)}</p>
    </>
  );
}

/** Status cell — shared StatusBadge with the module config. */
export function renderStudentStatusCell({
  studentRow,
  statusBadgeConfig,
}: {
  studentRow: Student;
  statusBadgeConfig: StudentsListContentTableProps["statusBadgeConfig"];
}): React.ReactNode {
  return <StatusBadge status={studentRow.status || "active"} config={statusBadgeConfig} />;
}
