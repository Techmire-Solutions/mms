import { XCircle } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ModuleRowActionsMenu } from "@/components/app/ModuleRowActionsMenu";
import { PersonMessagingRowActionsExtras } from "@/components/app/PersonMessagingRowActionsExtras";
import { useTranslation } from "@/hooks/useTranslation";
import type { Enrollment } from "@/lib/data/enrollmentData";
import { enrollmentHoldsSeat, type Student, type toMessagingRecipient } from "@mms/shared";

export type MessageChannel = "whatsapp" | "sms" | "email";

export interface EnrollmentRowActionsProps {
  enrollment: Enrollment;
  student?: Student;
  showDeleted: boolean;
  canWrite: boolean;
  canDelete: boolean;
  /** When true, omit View (card already exposes a View control). */
  hideViewItem?: boolean;
  triggerClassName?: string;
  onView: (enrollment: Enrollment) => void;
  onCancel: (id: string) => void;
  onDelete?: (id: string) => void;
  onRestore?: (id: string) => void;
  openComposer: (
    channel: MessageChannel,
    recipients: ReturnType<typeof toMessagingRecipient>[],
  ) => void;
}

/**
 * Enrollments row/card actions — thin adapter over the shared
 * {@link ModuleRowActionsMenu}; Cancel is injected as a module extras item and
 * messaging items come from {@link PersonMessagingRowActionsExtras}.
 */
export function EnrollmentRowActions({
  enrollment,
  student,
  showDeleted,
  canWrite,
  canDelete,
  hideViewItem = false,
  triggerClassName,
  onView,
  onCancel,
  onDelete,
  onRestore,
  openComposer,
}: EnrollmentRowActionsProps): React.JSX.Element {
  const { t } = useTranslation();
  const studentDisplayName = enrollment.studentName?.trim() || student?.name || "";
  const phone = student?.phone ?? null;
  const email = student?.email ?? null;

  const openChannel = (channel: MessageChannel) => {
    openComposer(channel, [
      {
        id: enrollment.id,
        name: studentDisplayName,
        phone: phone ?? "",
        email: email ?? undefined,
      },
    ]);
  };

  return (
    <ModuleRowActionsMenu
      triggerLabel={t("enrollments.table.actions")}
      viewLabel={t("enrollments.table.viewProfile")}
      deleteLabel={t("common.delete")}
      restoreLabel={t("enrollments.restore")}
      archived={showDeleted}
      canWrite={canWrite}
      canDelete={canDelete}
      onView={() => onView(enrollment)}
      onEdit={undefined}
      onDelete={() => onDelete?.(enrollment.id)}
      onRestore={onRestore ? () => onRestore(enrollment.id) : undefined}
      hideViewItem={hideViewItem}
      triggerClassName={triggerClassName}
      extras={
        <>
          {!showDeleted &&
          canWrite &&
          enrollmentHoldsSeat(enrollment.status) &&
          enrollment.status !== "completed" ? (
            <DropdownMenuItem onClick={() => onCancel(enrollment.id)}>
              <XCircle className="w-3.5 h-3.5 me-2" /> {t("enrollments.actions.cancelShort")}
            </DropdownMenuItem>
          ) : null}
          <PersonMessagingRowActionsExtras
            phone={phone}
            email={email}
            hasWhatsApp={Boolean(phone)}
            hideMessagingItems={showDeleted}
            onWhatsApp={() => openChannel("whatsapp")}
            onSms={() => openChannel("sms")}
            onEmail={() => openChannel("email")}
            labels={{
              whatsapp: t("enrollments.list.actionWhatsApp"),
              sms: t("enrollments.list.actionSms"),
              email: t("enrollments.list.actionEmail"),
            }}
          />
        </>
      }
    />
  );
}
