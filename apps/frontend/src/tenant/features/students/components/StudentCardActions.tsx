import type { Student, toMessagingRecipient } from "@mms/shared";
import { ENTITY_CARD_OVERFLOW_TRIGGER_CLASS } from "@/components/app/entityCardChrome";
import { DirectoryCardFooterActions } from "@/components/app/DirectoryCardFooterActions";
import { useTranslation } from "@/hooks/useTranslation";
import { StudentsRowActions } from "@/tenant/features/students/components/StudentsRowActions";

export interface StudentCardActionsProps {
  student: Student;
  studentId: string;
  displayName: string;
  viewingDeleted: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canWriteMessaging?: boolean;
  onViewStudent: (student: Student) => void;
  onEdit: (student: Student) => void;
  onDelete: (id: string) => void;
  onRestore?: (id: string) => void;
  onOpenComposer?: (
    channel: "sms" | "whatsapp" | "email",
    recipients: ReturnType<typeof toMessagingRecipient>[],
  ) => void;
}

/** Contacts-shaped card footer: View + remaining icon actions. */
export function StudentCardActions({
  student,
  studentId,
  displayName,
  viewingDeleted,
  canWrite,
  canDelete,
  canWriteMessaging = false,
  onViewStudent,
  onEdit,
  onDelete,
  onRestore,
  onOpenComposer,
}: StudentCardActionsProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <DirectoryCardFooterActions
      onView={() => onViewStudent(student)}
      viewLabel={t("students.actionViewShort")}
      viewAriaLabel={`${t("students.list.viewProfile")} - ${displayName}`}
      overflowActions={
        <StudentsRowActions
          student={student}
          studentId={studentId}
          viewingDeleted={viewingDeleted}
          canWrite={canWrite}
          canDelete={canDelete}
          includeMessaging={Boolean(onOpenComposer) && canWriteMessaging && !viewingDeleted}
          hideViewItem
          triggerClassName={ENTITY_CARD_OVERFLOW_TRIGGER_CLASS}
          contentClassName="w-40"
          iconClassName="w-3.5 h-3.5"
          onViewStudent={onViewStudent}
          onEdit={onEdit}
          onDelete={onDelete}
          onRestore={onRestore}
          onOpenComposer={onOpenComposer}
        />
      }
    />
  );
}
