import { useTranslation } from "@mms/fe-core/i18n";
import { ModuleRowActionsMenu } from "@mms/ui/app/ModuleRowActionsMenu";
import { PersonMessagingRowActionsExtras } from "@mms/fe-core/components/PersonMessagingRowActionsExtras";
import { resolveFacultyPrimaryChannels } from "../lib/facultyPrimaryChannels";
import { facultyMessagingLabels } from "../lib/facultyMessagingLabels";
import { hasWhatsApp, type Faculty } from "@mms/contracts";
import { resolveFacultyDisplayName } from "../lib/facultyFieldDisplay";

export interface FacultyListRowActionsProps {
  faculty?: Faculty;
  facultyId?: string;
  showDeleted: boolean;
  canWrite: boolean;
  canDelete: boolean;
  /** When true, omit View (card already exposes a View control). */
  hideViewItem?: boolean;
  /** When true, omit messaging items (card face already shows channels). */
  hideMessagingItems?: boolean;
  triggerClassName?: string;
  onEdit: (faculty: Faculty) => void;
  onRequestDelete: (id: string) => void;
  onView: (faculty: Faculty) => void;
  onRestore?: (id: string) => void;
  onSms?: (faculty: Faculty[]) => void;
  onWhatsApp?: (faculty: Faculty[]) => void;
  onEmail?: (faculty: Faculty[]) => void;
}

/**
 * Faculty row/card actions — thin adapter over the shared
 * {@link ModuleRowActionsMenu}; messaging items are injected as module extras
 * and omitted (not disabled) when handlers are undefined or the channel is unavailable.
 */
export function FacultyListRowActions(props: FacultyListRowActionsProps): React.JSX.Element {
  const { t } = useTranslation();
  const {
    faculty,
    facultyId,
    showDeleted,
    canWrite,
    canDelete,
    hideViewItem = false,
    hideMessagingItems = false,
    triggerClassName,
    onEdit,
    onRequestDelete,
    onView,
    onRestore,
    onSms,
    onWhatsApp,
    onEmail,
  } = props;
  const effectiveFaculty = faculty;
  if (!effectiveFaculty) {
    return <></>;
  }
  const effectiveId = facultyId ?? String(effectiveFaculty.id);
  const { phone, email } = resolveFacultyPrimaryChannels(effectiveFaculty);

  return (
    <ModuleRowActionsMenu
      triggerLabel={t("common.actionsFor", {
        name: resolveFacultyDisplayName(effectiveFaculty, t),
      })}
      viewLabel={t("faculty.list.viewDetails")}
      editLabel={t("common.edit")}
      deleteLabel={t("common.delete")}
      restoreLabel={t("faculty.restore")}
      archived={showDeleted}
      canWrite={canWrite}
      canDelete={canDelete}
      onView={onView ? () => onView(effectiveFaculty) : undefined}
      onEdit={() => onEdit(effectiveFaculty)}
      onDelete={() => onRequestDelete(effectiveId)}
      onRestore={onRestore ? () => onRestore(effectiveId) : undefined}
      hideViewItem={hideViewItem}
      triggerClassName={triggerClassName}
      contentClassName="w-40"
      iconClassName="w-3.5 h-3.5"
      extras={
        <PersonMessagingRowActionsExtras
          phone={phone}
          email={email}
          hasWhatsApp={hasWhatsApp({ phone: phone ?? undefined })}
          hideMessagingItems={hideMessagingItems || showDeleted}
          onWhatsApp={() => onWhatsApp?.([effectiveFaculty])}
          onSms={() => onSms?.([effectiveFaculty])}
          onEmail={() => onEmail?.([effectiveFaculty])}
          labels={facultyMessagingLabels(t)}
        />
      }
    />
  );
}
