import React from "react";
import { useNavigate } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import type { Student } from "@mms/shared";
import { DetailDrawerShell } from "@/components/app/DetailDrawerShell";
import { DrawerUpdatedStamp } from "@/components/app/DrawerUpdatedStamp";
import type { useMessageComposerState } from "@/hooks/useMessageComposerState";
import { StudentArchivedBanner } from "@/tenant/features/students/components/StudentArchivedBanner";
import { StudentDetailContactSection } from "@/tenant/features/students/components/StudentDetailContactSection";
import { StudentDetailFieldsSection } from "@/tenant/features/students/components/StudentDetailFieldsSection";
import { StudentDetailHeroCard } from "@/tenant/features/students/components/StudentDetailHeroCard";
import { DetailNotesBlock } from "@/components/app/DetailNotesBlock";
import { StudentDetailQuickActions } from "@/tenant/features/students/components/StudentDetailQuickActions";
import { StudentDetailRelationsSection } from "@/tenant/features/students/components/StudentDetailRelationsSection";
import { StudentDetailSessionsSection } from "@/tenant/features/students/components/StudentDetailSessionsSection";
import { StudentDetailSiblingsSection } from "@/tenant/features/students/components/StudentDetailSiblingsSection";
import { StudentDetailHeaderActions } from "@/tenant/features/students/components/StudentDetailHeaderActions";
import { useStudentDetailModel } from "@/tenant/features/students/hooks/useStudentDetailModel";

export interface StudentDetailProps {
  student: Student;
  onClose: () => void;
  onEdit?: (student: Student) => void;
  canDelete?: boolean;
  onRestore?: (studentId: string) => void | Promise<void>;
  /** Page-owned composer — do not create a second MessageComposer in the drawer. */
  openComposer: ReturnType<typeof useMessageComposerState>["openComposer"];
  canWriteMessaging: boolean;
  onPrintIdCard?: (student: Student) => void;
  onViewStudent?: (student: Student) => void;
  onViewContact?: (contactId: string | number) => void;
}

export const StudentDetail = function StudentDetail({
  student,
  onClose,
  onEdit,
  canDelete = false,
  onRestore,
  openComposer,
  canWriteMessaging,
  onPrintIdCard,
  onViewStudent,
  onViewContact,
}: StudentDetailProps): React.JSX.Element {
  const {
    t,
    statusBadgeConfig,
    sortedEnabledFields,
    hydratedRelationships,
    studentContactProfile,
    age,
    enrolledSessionDetails,
    sessionsLoading,
    sessionsError,
    primaryPhone,
    primaryEmail,
    hasWhatsAppContact,
    hasVisibleDetailFields,
    showNotesSection,
    siblings,
    siblingMap,
  } = useStudentDetailModel(student);

  const isArchived = Boolean(student.deletedAt);
  const navigate = useNavigate();

  const handleNavigateToContact = (contactId: string | number) => {
    if (onViewContact) {
      onViewContact(contactId);
    } else {
      navigate(`/contacts?id=${encodeURIComponent(String(contactId))}`);
    }
  };

  const headerActionsNode = (
    <StudentDetailHeaderActions
      student={student}
      isArchived={isArchived}
      canDelete={canDelete}
      canEdit={Boolean(onEdit)}
      onPrintIdCard={onPrintIdCard}
      onRestore={onRestore ? () => void onRestore(String(student.id)) : undefined}
      onEdit={onEdit ? () => onEdit(student) : undefined}
      printLabel={t("students.detail.printIdCard")}
      restoreLabel={t("students.restore")}
      editLabel={t("students.detail.editTitle")}
    />
  );

  // Only mount the archived banner when the student is actually archived — no-op otherwise.
  const headerExtraNode = isArchived ? <StudentArchivedBanner student={student} /> : null;

  const footerNode = (
    <DrawerUpdatedStamp
      updatedAt={student.updatedAt}
      createdAt={student.createdAt}
      label={t("students.detail.updatedLabel")}
    />
  );

  return (
    <DetailDrawerShell
      onClose={onClose}
      title={t("students.detail.title")}
      subtitle={
        isArchived
          ? t("students.detail.archivedSubtitle")
          : t("students.detail.grSubtitle", { gr: student.grNumber || t("common.notSpecified") })
      }
      icon={GraduationCap}
      ariaLabel={t("students.detail.ariaLabel", {
        name: student.name?.trim() || t("students.form.student"),
      })}
      headerActions={headerActionsNode}
      headerExtra={headerExtraNode}
      footer={footerNode}
    >
      <StudentDetailHeroCard student={student} statusBadgeConfig={statusBadgeConfig} />

      {!isArchived && canWriteMessaging && (
        <StudentDetailQuickActions
          student={student}
          primaryPhone={primaryPhone}
          primaryEmail={primaryEmail}
          hasWhatsAppContact={hasWhatsAppContact}
          openComposer={openComposer}
        />
      )}

      {/* Linked Contact Details & Communication Channels */}
      <StudentDetailContactSection
        contactProfile={studentContactProfile}
        canMessage={!isArchived && canWriteMessaging}
        openComposer={openComposer}
        onNavigateToContact={handleNavigateToContact}
      />

      {/* All Family & Contact Network Relationships */}
      <StudentDetailRelationsSection
        relationships={hydratedRelationships}
        canMessage={!isArchived && canWriteMessaging}
        openComposer={openComposer}
        onNavigateToContact={handleNavigateToContact}
      />

      {hasVisibleDetailFields && (
        <StudentDetailFieldsSection
          student={student}
          sortedEnabledFields={sortedEnabledFields}
          age={age}
        />
      )}

      {showNotesSection && student.notes ? (
        <DetailNotesBlock title={t("students.form.notesSection")} notes={student.notes} />
      ) : null}

      <StudentDetailSiblingsSection
        siblings={siblings}
        statusBadgeConfig={statusBadgeConfig}
        onViewSibling={
          onViewStudent
            ? (siblingId) => {
                const target = siblingMap.get(String(siblingId));
                if (target) onViewStudent(target);
              }
            : undefined
        }
      />

      <StudentDetailSessionsSection
        sessions={enrolledSessionDetails}
        loading={sessionsLoading}
        error={sessionsError}
      />
    </DetailDrawerShell>
  );
};

export const StudentDrawer = StudentDetail;
export default StudentDetail;
