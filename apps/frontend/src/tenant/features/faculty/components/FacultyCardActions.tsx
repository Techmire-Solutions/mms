import { ENTITY_CARD_OVERFLOW_TRIGGER_CLASS } from "@/components/app/entityCardChrome";
import { DirectoryCardFooterActions } from "@/components/app/DirectoryCardFooterActions";
import { useTranslation } from "@/hooks/useTranslation";
import type { Faculty } from "@mms/shared";
import { FacultyListRowActions } from "@/tenant/features/faculty/components/FacultyListRowActions";

export interface FacultyCardActionsProps {
  faculty: Faculty;
  facultyId: string;
  displayName: string;
  showDeleted: boolean;
  canWrite: boolean;
  canDelete: boolean;
  onView: (faculty: Faculty) => void;
  onEdit: (faculty: Faculty) => void;
  onRequestDelete: (id: string) => void;
  onRestore?: (id: string) => void;
  onSms?: (faculty: Faculty[]) => void;
  onWhatsApp?: (faculty: Faculty[]) => void;
  onEmail?: (faculty: Faculty[]) => void;
}

/** Contacts-shaped card footer: View + overflow menu. */
export function FacultyCardActions({
  faculty,
  facultyId,
  displayName,
  showDeleted,
  canWrite,
  canDelete,
  onView,
  onEdit,
  onRequestDelete,
  onRestore,
  onSms,
  onWhatsApp,
  onEmail,
}: FacultyCardActionsProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <DirectoryCardFooterActions
      onView={() => onView(faculty)}
      viewLabel={t("faculty.actionViewShort")}
      viewAriaLabel={`${t("faculty.list.viewDetails")} - ${displayName}`}
      overflowActions={
        <FacultyListRowActions
          faculty={faculty}
          facultyId={facultyId}
          showDeleted={showDeleted}
          canWrite={canWrite}
          canDelete={canDelete}
          hideViewItem
          triggerClassName={ENTITY_CARD_OVERFLOW_TRIGGER_CLASS}
          onEdit={onEdit}
          onRequestDelete={onRequestDelete}
          onView={onView}
          onRestore={onRestore}
          onSms={onSms}
          onWhatsApp={onWhatsApp}
          onEmail={onEmail}
        />
      }
    />
  );
}
