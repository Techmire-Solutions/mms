import type { Student } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { EntityCard } from "@/components/app/EntityCard";
import { ParentNamesSubtitle } from "@/tenant/features/students/components/ParentNamesSubtitle";

export interface StudentCardHeaderProps {
  student: Student;
  studentId?: string;
  isSelected: boolean;
  displayName?: string;
  onSelectOne: (id: string) => void;
  onViewStudent: (student: Student) => void;
  isColumnVisible?: (key: string) => boolean;
  reducedMotion?: boolean;
}

/** Contacts-shaped horizontal card header: checkbox | avatar + student name (with father & mother below). */
export function StudentCardHeader({
  student,
  studentId,
  isSelected,
  displayName,
  onSelectOne,
  onViewStudent,
  isColumnVisible,
  reducedMotion = false,
}: StudentCardHeaderProps): React.JSX.Element {
  const { t } = useTranslation();
  const id = studentId ?? String(student.id);
  const studentName = student.name?.trim() || displayName || "";
  const fatherName = student.fatherName?.trim();
  const motherName = student.motherName?.trim();
  const guardianName = student.guardianName?.trim();

  const showParents = !isColumnVisible || isColumnVisible("parents");
  const showGender = !isColumnVisible || isColumnVisible("gender");
  const effectiveGender = showGender ? student.gender : undefined;

  const subtitle = showParents ? (
    <ParentNamesSubtitle
      fatherName={fatherName}
      motherName={motherName}
      guardianName={guardianName}
      t={t}
    />
  ) : undefined;

  return (
    <EntityCard.Header
      id={id}
      displayName={studentName}
      avatar={typeof student.avatar === "string" ? student.avatar : undefined}
      gender={effectiveGender}
      isSelected={isSelected}
      onSelect={() => onSelectOne(id)}
      selectAriaLabel={t("students.table.selectStudent", { name: studentName })}
      onView={() => onViewStudent(student)}
      viewAriaLabel={`${t("students.list.viewProfile")} - ${studentName}`}
      subtitle={subtitle}
      reducedMotion={reducedMotion}
    />
  );
}
