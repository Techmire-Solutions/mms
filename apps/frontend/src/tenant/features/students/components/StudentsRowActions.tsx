import { hasWhatsApp, toMessagingRecipient, type Student } from "@mms/shared";
import { PersonMessagingRowActionsExtras } from "@/components/app/PersonMessagingRowActionsExtras";
import { useTranslation } from "@/hooks/useTranslation";
import { ModuleRowActionsMenu } from "@/components/app/ModuleRowActionsMenu";
import type { StudentsListContentMessagingRecipient } from "@/tenant/features/students/lib/studentsListTypes";

export interface StudentsRowActionsProps {
  student: Student;
  studentId: string;
  viewingDeleted: boolean;
  canWrite: boolean;
  canDelete: boolean;
  includeMessaging?: boolean;
  /** When true, omit View (card/table already exposes a View control). */
  hideViewItem?: boolean;
  triggerClassName: string;
  contentClassName: string;
  iconClassName: string;
  onViewStudent: (student: Student) => void;
  onEdit: (student: Student) => void;
  onDelete: (id: string, deletionReason?: string) => void;
  onRestore?: (id: string) => void;
  onOpenComposer?: (
    mode: "whatsapp" | "sms" | "email",
    recipients: StudentsListContentMessagingRecipient[],
  ) => void;
}

/**
 * Students Work row/card actions — thin adapter over the shared
 * {@link ModuleRowActionsMenu}; messaging channels are injected as module extras.
 */
export function StudentsRowActions({
  student,
  studentId,
  viewingDeleted,
  canWrite,
  canDelete,
  includeMessaging = false,
  hideViewItem = false,
  triggerClassName,
  contentClassName,
  iconClassName,
  onViewStudent,
  onEdit,
  onDelete,
  onRestore,
  onOpenComposer,
}: StudentsRowActionsProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <ModuleRowActionsMenu
      triggerLabel={t("students.list.actionsAria")}
      viewLabel={t("students.list.viewProfile")}
      editLabel={t("students.list.editStudent")}
      deleteLabel={t("students.list.remove")}
      restoreLabel={t("students.restore")}
      archived={viewingDeleted}
      canWrite={canWrite}
      canDelete={canDelete}
      onView={() => onViewStudent(student)}
      onEdit={() => onEdit(student)}
      onDelete={() => onDelete(studentId)}
      onRestore={onRestore ? () => onRestore(studentId) : undefined}
      hideViewItem={hideViewItem}
      triggerClassName={triggerClassName}
      contentClassName={contentClassName}
      iconClassName={iconClassName}
      extras={
        <PersonMessagingRowActionsExtras
          phone={student.phone?.trim() || null}
          email={student.email?.trim() || null}
          hasWhatsApp={hasWhatsApp(student)}
          hideMessagingItems={!includeMessaging || !onOpenComposer}
          onWhatsApp={() => onOpenComposer?.("whatsapp", [toMessagingRecipient(student)])}
          onSms={() => onOpenComposer?.("sms", [toMessagingRecipient(student)])}
          onEmail={() => onOpenComposer?.("email", [toMessagingRecipient(student)])}
          labels={{
            whatsapp: t("students.list.actionWhatsApp"),
            sms: t("students.list.actionSms"),
            email: t("students.list.actionEmail"),
          }}
        />
      }
    />
  );
}
