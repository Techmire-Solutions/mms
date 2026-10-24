import { useTranslation } from "@/hooks/useTranslation";
import { ModuleRowActionsMenu } from "@/components/app/ModuleRowActionsMenu";
import type { Session } from "@/lib/data/sessionsData";

interface SessionListRowActionsProps {
  session: Session;
  showDeleted: boolean;
  canDelete: boolean;
  /** When true, omit View (card already exposes a View control). */
  hideViewItem?: boolean;
  triggerClassName?: string;
  onRequestDelete: (id: string) => void;
  onRestore: (id: string) => void;
  onView?: (session: Session) => void;
}

/** Sessions row/card actions — thin adapter over the shared ModuleRowActionsMenu. */
export function SessionListRowActions({
  session,
  showDeleted,
  canDelete,
  hideViewItem = false,
  triggerClassName,
  onRequestDelete,
  onRestore,
  onView,
}: SessionListRowActionsProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <ModuleRowActionsMenu
      triggerLabel={t("sessions.table.actions")}
      viewLabel={t("sessions.table.viewProfile")}
      deleteLabel={t("common.delete")}
      restoreLabel={t("sessions.restore")}
      archived={showDeleted}
      canWrite={false}
      canDelete={canDelete}
      onView={onView ? () => onView(session) : undefined}
      onEdit={undefined}
      onDelete={() => onRequestDelete(session.id)}
      onRestore={showDeleted ? () => onRestore(session.id) : undefined}
      hideViewItem={hideViewItem}
      triggerClassName={triggerClassName}
    />
  );
}
