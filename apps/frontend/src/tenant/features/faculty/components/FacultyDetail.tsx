import React, { useState } from "react";
import { IdCard, School, UserCheck } from "lucide-react";
import { hydrateFacultyFromContact, type FacultyMember } from "@mms/shared";
import { Drawer } from "@/components/app/Drawer";
import { DetailDrawerRestoreOrEditAction } from "@/components/app/DetailDrawerArchiveChrome";
import { DrawerUpdatedStamp } from "@/components/app/DrawerUpdatedStamp";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import type { useMessageComposerState } from "@/hooks/useMessageComposerState";
import { useFacultyConfig } from "@/hooks/useStandardModuleConfig";
import { FacultyArchivedBanner } from "@/tenant/features/faculty/components/FacultyArchivedBanner";
import { FacultyDetailFieldsSection } from "@/tenant/features/faculty/components/FacultyDetailFieldsSection";
import { FacultyDetailHeroCard } from "@/tenant/features/faculty/components/FacultyDetailHeroCard";
import { DetailNotesBlock } from "@/components/app/DetailNotesBlock";
import { FacultyDetailAssignmentsSection } from "@/tenant/features/faculty/components/FacultyDetailAssignmentsSection";
import { FacultyReportingHierarchyCard } from "@/tenant/features/faculty/components/FacultyReportingHierarchyCard";
import { FacultyDetailIjazahSection } from "@/tenant/features/faculty/components/FacultyDetailIjazahSection";
import { FacultyLeaveModal } from "@/tenant/features/faculty/components/FacultyLeaveModal";
import { useFacultyMutations } from "@/tenant/features/faculty/hooks/useFacultyMutations";
import { FacultyDetailQuickActions } from "@/tenant/features/faculty/components/FacultyDetailQuickActions";
import { FacultyDetailSessionsSection } from "@/tenant/features/faculty/components/FacultyDetailSessionsSection";
import { resolveFacultyDisplayName } from "@/tenant/features/faculty/lib/facultyFieldDisplay";
import { useFacultyDetailModel } from "@/tenant/features/faculty/hooks/useFacultyDetailModel";

export interface FacultyDetailProps {
  faculty: FacultyMember;
  onClose: () => void;
  onEdit?: (faculty: FacultyMember) => void;
  canDelete?: boolean;
  onRestore?: (id: string) => void | Promise<void>;
  onPrintIdCard?: (faculty: FacultyMember) => void;
  /** Page-owned composer — do not create a second MessageComposer in the drawer. */
  openComposer: ReturnType<typeof useMessageComposerState>["openComposer"];
  canWriteMessaging: boolean;
  onFilterSubordinates?: (facultyId: string) => void;
}

export function FacultyDetail({
  faculty,
  onClose,
  onEdit,
  canDelete = false,
  onRestore,
  onPrintIdCard,
  openComposer,
  canWriteMessaging,
  onFilterSubordinates,
}: FacultyDetailProps): React.JSX.Element {
  const { t } = useTranslation();
  const { settings, isFieldEnabled } = useFacultyConfig();
  const {
    statusConfig,
    detailFields,
    linkedContact,
    primaryPhone,
    primaryEmail,
    hasWhatsAppContact,
    hasVisibleDetailFields,
    assignedClasses,
    sessionsLoading,
    sessionsError,
  } = useFacultyDetailModel(faculty);

  const effectiveFaculty = React.useMemo(() => {
    if (!linkedContact) return faculty;
    return hydrateFacultyFromContact(faculty, [linkedContact]);
  }, [faculty, linkedContact]);

  const isArchived = Boolean(faculty.deletedAt);
  const displayName = resolveFacultyDisplayName(effectiveFaculty, t, linkedContact);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const { updateFaculty } = useFacultyMutations();

  const handleSaveLeave = async (patch: Partial<FacultyMember>) => {
    await updateFaculty.mutateAsync({
      params: { id: String(faculty.id) },
      body: patch,
    });
  };

  const headerActionsNode = (
    <div className="flex items-center gap-1.5">
      {!isArchived && Boolean(onEdit) && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setLeaveModalOpen(true)}
          className="min-h-11 px-3 gap-1.5 font-medium text-xs border-border/60 hover:bg-muted/80"
          title={t("faculty.leave.manage")}
          aria-label={t("faculty.leave.manage")}
        >
          <UserCheck className="w-3.5 h-3.5 text-primary" aria-hidden />
          <span className="hidden sm:inline">{t("faculty.leave.manage")}</span>
        </Button>
      )}
      {!isArchived && onPrintIdCard && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPrintIdCard(faculty)}
          className="min-h-11 px-3 gap-1.5 font-medium text-xs border-border/60 hover:bg-muted/80"
          title={t("faculty.detail.printIdCard")}
          aria-label={t("faculty.detail.printIdCard")}
        >
          <IdCard className="w-3.5 h-3.5" aria-hidden />
          <span className="hidden sm:inline">{t("faculty.detail.printIdCard")}</span>
        </Button>
      )}
      <DetailDrawerRestoreOrEditAction
        isArchived={isArchived}
        canRestore={canDelete}
        canEdit={Boolean(onEdit)}
        restoreLabel={t("faculty.restore")}
        editLabel={t("faculty.detail.editTitle")}
        onRestore={onRestore ? () => onRestore(String(faculty.id)) : undefined}
        onEdit={onEdit ? () => onEdit(faculty) : undefined}
      />
    </div>
  );

  const headerExtraNode = <FacultyArchivedBanner faculty={faculty} />;

  const footerNode = (
    <DrawerUpdatedStamp
      updatedAt={faculty.updatedAt}
      createdAt={faculty.createdAt}
      label={t("faculty.detail.updatedLabel")}
    />
  );

  const resolvedSubtitle = isArchived
    ? t("faculty.detail.archivedSubtitle")
    : t("faculty.detail.employeeSubtitle", { id: faculty.employeeId || t("common.notSpecified") });

  return (
    <Drawer
      onClose={onClose}
      title={t("faculty.detail.title")}
      subtitle={resolvedSubtitle}
      icon={School}
      ariaLabel={t("faculty.detail.ariaLabel", { name: displayName })}
      headerActions={headerActionsNode}
      headerExtra={headerExtraNode}
      footer={footerNode}
    >
      <FacultyDetailHeroCard
        faculty={effectiveFaculty}
        displayName={displayName}
        avatar={linkedContact?.avatar ?? effectiveFaculty.avatar}
        statusConfig={statusConfig}
        showStatus={isFieldEnabled("status")}
      />

      {effectiveFaculty.leaveDetails?.isOnLeave && (
        <div className="p-3 rounded-lg border border-warning/30 bg-warning/10 text-start space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-xs text-warning">
              {t("faculty.leave.onLeave")}:{" "}
              {effectiveFaculty.leaveDetails.category
                ? t(
                    `faculty.leave.category.${effectiveFaculty.leaveDetails.category}` as "faculty.leave.category.personal",
                  )
                : ""}
            </span>
            {effectiveFaculty.leaveDetails.startDate && effectiveFaculty.leaveDetails.endDate && (
              <span className="text-3xs text-warning font-medium">
                {effectiveFaculty.leaveDetails.startDate} → {effectiveFaculty.leaveDetails.endDate}
              </span>
            )}
          </div>
          {effectiveFaculty.leaveDetails.substituteFacultyName && (
            <p className="text-xs text-foreground font-medium">
              {t("faculty.leave.substituteBadge", {
                name: effectiveFaculty.leaveDetails.substituteFacultyName,
              })}
            </p>
          )}
          {effectiveFaculty.leaveDetails.reason && (
            <p className="text-xs text-muted-foreground italic pt-1 border-t border-warning/20 text-pretty">
              {effectiveFaculty.leaveDetails.reason}
            </p>
          )}
        </div>
      )}

      {!isArchived && canWriteMessaging && (
        <FacultyDetailQuickActions
          faculty={effectiveFaculty}
          displayName={displayName}
          primaryPhone={primaryPhone}
          primaryEmail={primaryEmail}
          hasWhatsAppContact={hasWhatsAppContact}
          canWriteMessaging={canWriteMessaging}
          onOpenComposer={openComposer}
        />
      )}

      {hasVisibleDetailFields && (
        <FacultyDetailFieldsSection
          faculty={effectiveFaculty}
          detailFields={detailFields}
          displayName={displayName}
          settings={settings}
        />
      )}

      <FacultyDetailAssignmentsSection
        facultyId={String(faculty.id)}
        primaryDesignation={effectiveFaculty.designation}
        primaryDepartment={effectiveFaculty.department}
      />

      <FacultyReportingHierarchyCard
        faculty={effectiveFaculty}
        onFilterSubordinates={onFilterSubordinates}
      />

      <FacultyDetailIjazahSection faculty={effectiveFaculty} />

      <FacultyDetailSessionsSection
        assignedClasses={assignedClasses}
        loading={sessionsLoading}
        error={sessionsError}
      />

      {faculty.notes && isFieldEnabled("notes") ? (
        <DetailNotesBlock title={t("faculty.detail.notesSection")} notes={faculty.notes} />
      ) : null}

      {leaveModalOpen && (
        <FacultyLeaveModal
          open={leaveModalOpen}
          onClose={() => setLeaveModalOpen(false)}
          faculty={effectiveFaculty}
          onSave={handleSaveLeave}
        />
      )}
    </Drawer>
  );
}

export const FacultyDrawer = FacultyDetail;
export default FacultyDetail;
