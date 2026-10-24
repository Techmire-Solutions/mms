import { calcAge, formatDate, type Student } from "@mms/shared";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/app/StatusBadge";
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

/** Sessions cell — enrolled session-name pills (or empty note). */
export function renderStudentSessionsCell({
  sessionNames,
  t,
}: {
  sessionNames: string[];
  t: TranslationFunction;
}): React.ReactNode {
  return (
    <div className="flex flex-wrap gap-1">
      {sessionNames.length === 0 ? (
        <span className="text-xs text-muted-foreground italic">
          {t("students.list.notEnrolled")}
        </span>
      ) : (
        sessionNames.map((sessionName, idx) => (
          <Badge
            as="span"
            size="sm"
            key={`${sessionName}-${idx}`}
            tone="primary"
            className="px-1.5 py-0.5 rounded-full font-medium"
          >
            {sessionName}
          </Badge>
        ))
      )}
    </div>
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
