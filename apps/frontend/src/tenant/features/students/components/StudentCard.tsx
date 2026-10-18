import type React from "react";
import { toMessagingRecipient } from "@mms/shared";
import { DirectoryCard } from "@/components/app/DirectoryCard";
import { getGenderAccentBarClass } from "@/lib/ui/directoryCardAccent";
import { StudentArchivedBanner } from "@/tenant/features/students/components/StudentArchivedBanner";
import { StudentCardActions } from "@/tenant/features/students/components/StudentCardActions";
import { StudentCardHeader } from "@/tenant/features/students/components/StudentCardHeader";
import { StudentCardMetadata } from "@/tenant/features/students/components/StudentCardMetadata";
import { type useStudentEntityDescriptor } from "@/tenant/features/students/hooks/useStudentEntityDescriptor";
import type { StudentsListCardsProps } from "@/tenant/features/students/lib/studentsListTypes";

export interface StudentCardComponentProps {
  student: StudentsListCardsProps["paginatedStudents"][number];
  selectedIds: string[];
  viewingDeleted: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canWriteMessaging: boolean;
  statusBadgeConfig: StudentsListCardsProps["statusBadgeConfig"];
  isColumnVisible: (key: string) => boolean;
  columnRegistry: StudentsListCardsProps["columnRegistry"];
  descriptor: ReturnType<typeof useStudentEntityDescriptor>;
  reducedMotion: boolean;
  onSelectOne: (id: string) => void;
  onViewStudent: (student: StudentsListCardsProps["paginatedStudents"][number]) => void;
  onEdit: (student: StudentsListCardsProps["paginatedStudents"][number]) => void;
  onDelete: (id: string) => void;
  onRestore?: (id: string) => void;
  onOpenComposer?: (
    channel: "sms" | "whatsapp" | "email",
    recipients: ReturnType<typeof toMessagingRecipient>[],
  ) => void;
}

export function StudentCard({
  student,
  selectedIds,
  viewingDeleted,
  canWrite,
  canDelete,
  canWriteMessaging,
  statusBadgeConfig,
  isColumnVisible,
  columnRegistry,
  descriptor,
  reducedMotion,
  onSelectOne,
  onViewStudent,
  onEdit,
  onDelete,
  onRestore,
  onOpenComposer,
}: StudentCardComponentProps): React.JSX.Element {
  const studentIdStr = String(student.id);
  const isSelected = selectedIds.includes(studentIdStr);
  const displayName = student.name || "";
  const phone = student.phone?.trim() || null;
  const email = student.email?.trim() || null;

  return (
    <DirectoryCard
      entity={student}
      selectedIds={selectedIds}
      // NOTE: Selection is restricted to users with delete permission.
      // All bulk actions (bulk delete / restore) require canDelete;
      // a canWrite-only user has no available bulk action to take.
      canSelect={canDelete}
      onToggleSelected={() => onSelectOne(studentIdStr)}
      onView={onViewStudent}
      onEdit={onEdit}
      reducedMotion={reducedMotion}
      accentClassName={
        isColumnVisible("gender") ? getGenderAccentBarClass(isSelected, student.gender) : undefined
      }
      header={{
        displayName,
      }}
      headerSlot={
        <StudentCardHeader
          student={student}
          studentId={studentIdStr}
          isSelected={isSelected}
          displayName={displayName}
          onSelectOne={onSelectOne}
          onViewStudent={onViewStudent}
          isColumnVisible={isColumnVisible}
          reducedMotion={reducedMotion}
        />
      }
      infoPills={{
        phone,
        phoneDisplay: phone,
        email,
        showPhone: isColumnVisible("phone"),
        showEmail: isColumnVisible("email"),
        showArchived: viewingDeleted,
        onWhatsApp:
          canWriteMessaging && onOpenComposer && phone
            ? () => onOpenComposer("whatsapp", [toMessagingRecipient(student)])
            : undefined,
        onSms:
          canWriteMessaging && onOpenComposer && phone
            ? () => onOpenComposer("sms", [toMessagingRecipient(student)])
            : undefined,
        onEmail:
          canWriteMessaging && onOpenComposer && email
            ? () => onOpenComposer("email", [toMessagingRecipient(student)])
            : undefined,
      }}
      metadataSlot={
        <StudentCardMetadata
          student={student}
          statusBadgeConfig={statusBadgeConfig}
          isColumnVisible={isColumnVisible}
          columnRegistry={columnRegistry}
          descriptor={descriptor}
        />
      }
      banner={
        viewingDeleted || student.deletedAt ? (
          <StudentArchivedBanner student={student} />
        ) : undefined
      }
      footer={
        <StudentCardActions
          student={student}
          studentId={studentIdStr}
          displayName={displayName}
          viewingDeleted={viewingDeleted}
          canWrite={canWrite}
          canDelete={canDelete}
          canWriteMessaging={canWriteMessaging}
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
