import type { ModuleColumnRegistryEntry } from "@mms/shared";
import { DirectoryCard } from "@/components/app/DirectoryCard";
import { ENTITY_CARD_OVERFLOW_TRIGGER_CLASS } from "@/components/app/entityCardChrome";
import type { StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import { ProgressBar } from "@/components/app/ProgressBar";
import { useTranslation } from "@/hooks/useTranslation";
import type { Session } from "@/lib/data/sessionsData";
import { SessionListRowActions } from "@/tenant/features/sessions/components/SessionListRowActions";
import { getSessionVisibleWorkColumns } from "@/tenant/features/sessions/lib/sessionListVisibleColumns";
import {
  getSessionCapacityMeta,
  renderSessionWorkColumnValue,
} from "@/tenant/features/sessions/components/sessionWorkColumnCell";

export interface SessionCardProps {
  session: Session;
  isSelected?: boolean;
  selectedIds?: string[];
  canSelectSessions: boolean;
  showDeleted: boolean;
  canDelete: boolean;
  isColumnVisible: (key: string) => boolean;
  columnRegistry: ModuleColumnRegistryEntry[];
  statusConfig: Record<string, StatusBadgeConfigItem>;
  typeConfig: Record<string, StatusBadgeConfigItem>;
  onView: (session: Session) => void;
  onToggleSelectedSession: (id: string, checked: boolean) => void;
  onRequestDelete: (id: string) => void;
  onRestore: (id: string) => void;
  reducedMotion?: boolean;
}

/** Work directory card — DirectoryCard SSOT (do not hand-compose EntityCard). */
export function SessionCard({
  session,
  isSelected,
  selectedIds = [],
  canSelectSessions,
  showDeleted,
  canDelete,
  isColumnVisible,
  columnRegistry,
  statusConfig,
  typeConfig,
  onView,
  onToggleSelectedSession,
  onRequestDelete,
  onRestore,
  reducedMotion = false,
}: SessionCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const effectiveSelectedIds =
    selectedIds.length > 0 ? selectedIds : isSelected ? [session.id] : [];
  const { totalCapacity, capacityPercent, classCount } = getSessionCapacityMeta(session);
  const visibleColumns = getSessionVisibleWorkColumns(columnRegistry, isColumnVisible, {
    excludeFace: true,
  });
  const columnOptions = { t, statusConfig, typeConfig };

  return (
    <DirectoryCard
      entity={session}
      selectedIds={effectiveSelectedIds}
      canSelect={canSelectSessions}
      onToggleSelected={onToggleSelectedSession}
      onView={onView}
      reducedMotion={reducedMotion}
      header={{
        displayName: session.name,
        subtitle: session.description ? (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{session.description}</p>
        ) : undefined,
      }}
      viewLabel={t("sessions.actionViewShort")}
      viewAriaLabel={`${t("sessions.table.viewProfile")} - ${session.name}`}
      columns={visibleColumns}
      keyFor={(col) => col.key}
      labelFor={(col) => col.label}
      renderValue={(col) =>
        renderSessionWorkColumnValue(session, col.key, { ...columnOptions, emptyFallback: null })
      }
      overflowActions={
        canDelete ? (
          <SessionListRowActions
            session={session}
            showDeleted={showDeleted}
            canDelete={canDelete}
            hideViewItem
            onView={onView}
            triggerClassName={ENTITY_CARD_OVERFLOW_TRIGGER_CLASS}
            onRequestDelete={onRequestDelete}
            onRestore={onRestore}
          />
        ) : null
      }
    >
      {totalCapacity > 0 ? (
        <div>
          <ProgressBar
            value={Math.min(capacityPercent, 100)}
            fillClassName={
              capacityPercent >= 100
                ? "bg-destructive"
                : capacityPercent >= 80
                  ? "bg-warning"
                  : "bg-success"
            }
            trackClassName="h-1 bg-border"
            aria-hidden="true"
          />
          <p className="text-xs text-muted-foreground mt-1">
            {t("sessions.card.capacityUsed", {
              percent: capacityPercent,
              count: classCount,
              classesLabel:
                classCount === 1
                  ? t("sessions.card.classSingular")
                  : t("sessions.card.classPlural"),
            })}
          </p>
        </div>
      ) : null}
    </DirectoryCard>
  );
}
