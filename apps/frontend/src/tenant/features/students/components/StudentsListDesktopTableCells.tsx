import { toMessagingRecipient, type ModuleColumnRegistryEntry, type Student } from "@mms/shared";
import { Button } from "@/components/ui/button";
import { ContactPhoneAction, ContactEmailAction } from "@/components/app/ContactAction";
import { PersonIdentityMeta } from "@/components/app/PersonIdentityMeta";
import { UserAvatar } from "@/components/app/UserAvatar";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { Badge } from "@/components/ui/badge";
import { renderStudentWorkColumnValue } from "@/tenant/features/students/components/studentWorkColumnCell";
import { ParentNamesSubtitle } from "@/tenant/features/students/components/ParentNamesSubtitle";
import type {
  StudentsListContentMessagingRecipient,
  StudentsListContentTableProps,
} from "@/tenant/features/students/lib/studentsListTypes";

export interface RenderStudentsListDesktopTableCellOptions {
  studentRow: Student;
  col: ModuleColumnRegistryEntry;
  studentIdStr: string;
  displayName: string;
  emptyDash: string;
  statusBadgeConfig: StudentsListContentTableProps["statusBadgeConfig"];
  onViewStudent: StudentsListContentTableProps["onViewStudent"];
  viewingDeleted: boolean;
  canWriteMessaging: boolean;
  onOpenComposer: (
    mode: "whatsapp" | "sms" | "email",
    recipients: StudentsListContentMessagingRecipient[],
  ) => void;
  t: TranslationFunction;
}

/** Cell content for one Students Work desktop table column. */
export function renderStudentsListDesktopTableCell({
  studentRow,
  col,
  studentIdStr,
  displayName,
  emptyDash,
  statusBadgeConfig,
  onViewStudent,
  viewingDeleted,
  canWriteMessaging,
  onOpenComposer,
  t,
}: RenderStudentsListDesktopTableCellOptions): React.ReactNode {
  switch (col.key) {
    case "name": {
      const studentName = studentRow.name?.trim() || displayName || emptyDash;
      const fatherName = studentRow.fatherName?.trim();
      const motherName = studentRow.motherName?.trim();
      const guardianName = studentRow.guardianName?.trim();

      return (
        <div className="flex items-start gap-3 min-w-0 py-0.5">
          <UserAvatar
            id={studentIdStr}
            name={studentName}
            avatar={typeof studentRow.avatar === "string" ? studentRow.avatar : undefined}
            gender={studentRow.gender}
            size="md"
            className="shrink-0 mt-0.5"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center min-w-0">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onViewStudent(studentRow)}
                dir="auto"
                className="h-auto p-0 text-sm font-semibold text-foreground hover:text-primary transition-colors text-start justify-start hover:bg-transparent"
                title={studentName}
              >
                <span className="block truncate font-bold">{studentName}</span>
              </Button>
            </div>
            <ParentNamesSubtitle
              fatherName={fatherName}
              motherName={motherName}
              guardianName={guardianName}
              t={t}
              className="text-xs text-muted-foreground leading-tight mt-0.5 space-y-0.5"
            />
            {viewingDeleted && studentRow.deletionReason ? (
              <p
                className="text-xs text-muted-foreground mt-0.5 line-clamp-2"
                title={studentRow.deletionReason}
              >
                {t("students.deletionReasonLabel")}: {studentRow.deletionReason}
              </p>
            ) : null}
          </div>
        </div>
      );
    }
    case "grNumber":
      return studentRow.grNumber ? (
        <Badge
          as="span"
          size="sm"
          tone="primary"
          className="px-1.5 py-0.5 rounded font-bold uppercase tracking-wider"
        >
          {t("students.grPrefix")}: {studentRow.grNumber}
        </Badge>
      ) : (
        <span className="text-sm text-muted-foreground">{emptyDash}</span>
      );
    case "gender":
      return studentRow.gender ? (
        <PersonIdentityMeta gender={studentRow.gender} size="sm" pill />
      ) : (
        <span className="text-sm text-muted-foreground">{emptyDash}</span>
      );
    case "phone": {
      const phone = studentRow.phone?.trim() || null;
      return (
        <ContactPhoneAction
          phone={phone}
          name={displayName}
          disabled={viewingDeleted}
          emptyFallback={<span className="text-sm text-muted-foreground">{emptyDash}</span>}
          labels={{
            call: t("students.detail.call"),
            sms: t("students.list.actionSms"),
            whatsapp: t("students.list.actionWhatsApp"),
            copy: t("contacts.table.copy"),
            copied: t("contacts.table.copied"),
          }}
          onWhatsApp={
            canWriteMessaging && phone
              ? () => onOpenComposer("whatsapp", [toMessagingRecipient(studentRow)])
              : undefined
          }
          onSms={
            canWriteMessaging && phone
              ? () => onOpenComposer("sms", [toMessagingRecipient(studentRow)])
              : undefined
          }
        />
      );
    }
    case "email": {
      const email = studentRow.email?.trim() || null;
      return (
        <ContactEmailAction
          email={email}
          name={displayName}
          disabled={viewingDeleted}
          emptyFallback={<span className="text-sm text-muted-foreground">{emptyDash}</span>}
          labels={{
            mail: t("students.list.actionEmail"),
            copy: t("contacts.table.copy"),
            copied: t("contacts.table.copied"),
          }}
          onEmail={
            canWriteMessaging && email
              ? () => onOpenComposer("email", [toMessagingRecipient(studentRow)])
              : undefined
          }
        />
      );
    }
    case "dob":
    case "parents":
    case "status":
    case "registeredDate":
    case "notes":
    default:
      return renderStudentWorkColumnValue(studentRow, col.key, {
        t,
        statusBadgeConfig,
        emptyFallback: <span className="text-sm text-muted-foreground">{emptyDash}</span>,
      });
  }
}
