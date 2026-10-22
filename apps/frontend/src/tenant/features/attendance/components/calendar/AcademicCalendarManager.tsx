import React, { useState } from "react";
import { CalendarDays, CopyPlus, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { formatDate, todayISO, type AcademicCalendarEvent } from "@mms/shared";
import {
  DataTable,
  DataTableRowActions,
  type DataTableColumn,
} from "@/components/common/data-table";
import { Button } from "@/components/ui/button";
import { ConfirmAlertDialog } from "@/components/app/ConfirmAlertDialog";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { ModuleTrashToggle } from "@/components/app/ModuleTrashToggle";
import { CompactSegmentedControl } from "@/components/app/CompactSegmentedControl";
import { useTranslation } from "@/hooks/useTranslation";
import { useAttendanceConfig } from "@/hooks/useStandardModuleConfig";
import {
  useAcademicCalendarActions,
  useAcademicCalendarEvents,
} from "@/tenant/features/attendance/hooks/useAcademicCalendar";
import { AcademicCalendarMonthView } from "./AcademicCalendarMonthView";
import { CalendarEventFormModal } from "./CalendarEventFormModal";
import { CalendarCopyFromSessionDialog } from "./CalendarCopyFromSessionDialog";

export interface AcademicCalendarManagerProps {
  canWrite: boolean;
  canDelete?: boolean;
}

type CalendarView = "month" | "list";

/** Attendance → Setup → Calendar: holidays, make-up days, exam periods and events. */
export function AcademicCalendarManager({
  canWrite,
  canDelete = false,
}: AcademicCalendarManagerProps): React.JSX.Element {
  const { t } = useTranslation();
  const { settings } = useAttendanceConfig();
  const [view, setView] = useState<CalendarView>("month");
  const [month, setMonth] = useState(() => `${todayISO().slice(0, 7)}-01`);
  const [showDeleted, setShowDeleted] = useState(false);
  const [editing, setEditing] = useState<AcademicCalendarEvent | null>(null);
  const [initialDate, setInitialDate] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [toDelete, setToDelete] = useState<AcademicCalendarEvent | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const year = month.slice(0, 4);
  // Month view needs neighbours of the visible month; a year window covers both views.
  const query = useAcademicCalendarEvents({
    from: `${Number(year) - 1}-12-01`,
    to: `${Number(year) + 1}-01-31`,
    includeDeleted: canDelete && showDeleted,
  });
  const actions = useAcademicCalendarActions();
  const rows = query.data ?? [];

  const openEditor = (row: AcademicCalendarEvent | null, date = "") => {
    if (!canWrite) return;
    setEditing(row);
    setInitialDate(date);
    setModalOpen(true);
  };

  const columns: DataTableColumn<AcademicCalendarEvent>[] = [
    {
      id: "title",
      label: t("attendance.calendar.title"),
      fixed: true,
      render: (row) => <span className="font-medium">{row.title}</span>,
    },
    {
      id: "kind",
      label: t("attendance.calendar.kind"),
      width: 150,
      searchValue: (row) => t(`attendance.calendar.kinds.${row.kind}`),
      render: (row) => t(`attendance.calendar.kinds.${row.kind}`),
    },
    {
      id: "dates",
      label: t("attendance.calendar.dates"),
      width: 220,
      render: (row) =>
        row.startOn === row.endOn
          ? formatDate(row.startOn)
          : `${formatDate(row.startOn)} – ${formatDate(row.endOn)}`,
    },
    {
      id: "scope",
      label: t("attendance.calendar.appliesTo"),
      width: 150,
      render: (row) => t(`attendance.calendar.scope.${row.scope}`),
    },
  ];

  if (query.isError) {
    return (
      <ErrorState
        title={t("attendance.calendar.loadFailed")}
        onRetry={() => void query.refetch()}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-pretty text-sm text-muted-foreground">{t("attendance.calendar.hint")}</p>
        <CompactSegmentedControl
          value={view}
          onChange={(value) => setView(value === "list" ? "list" : "month")}
          options={[
            { value: "month", label: t("attendance.calendar.monthView") },
            { value: "list", label: t("attendance.calendar.listView") },
          ]}
        />
      </div>
      {view === "month" ? (
        <AcademicCalendarMonthView
          month={month}
          onMonthChange={setMonth}
          events={rows.filter((row) => !row.deletedAt)}
          workingDays={settings.workingDays}
          onDayClick={canWrite ? (date) => openEditor(null, date) : undefined}
          onEventClick={canWrite ? (event) => openEditor(event) : undefined}
        />
      ) : (
        <DataTable
          tableId="attendance.setup.calendar"
          label={t("attendance.setup.calendar")}
          data={rows}
          columns={columns}
          isLoading={query.isLoading}
          searchPlaceholder={t("attendance.calendar.search")}
          card={{ title: (row) => row.title }}
          rowClassName={(row) => (row.deletedAt ? "opacity-70" : undefined)}
          primaryAction={
            canWrite ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setCopyOpen(true)}
                  className="min-h-11"
                >
                  <CopyPlus className="size-4" aria-hidden />
                  {t("attendance.calendar.copyFromSession")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => openEditor(null)}
                  className="min-h-11"
                >
                  <Plus className="size-4" aria-hidden />
                  {t("attendance.calendar.add")}
                </Button>
              </div>
            ) : undefined
          }
          toolbarExtras={
            canDelete ? (
              <ModuleTrashToggle
                showDeleted={showDeleted}
                onToggle={() => setShowDeleted((value) => !value)}
                showDeletedLabel={t("attendance.calendar.showDeleted")}
                showActiveLabel={t("attendance.calendar.showActive")}
              />
            ) : undefined
          }
          renderRowActions={
            canWrite
              ? (row) => (
                  <DataTableRowActions
                    actions={
                      row.deletedAt
                        ? [
                            {
                              id: "restore",
                              label: `${t("attendance.calendar.restore")} ${row.title}`,
                              icon: RotateCcw,
                              onClick: () => void actions.restore(row),
                              disabled: actions.isPending,
                            },
                          ]
                        : [
                            {
                              id: "edit",
                              label: `${t("common.edit")} ${row.title}`,
                              icon: Pencil,
                              onClick: () => openEditor(row),
                              disabled: actions.isPending,
                            },
                            {
                              id: "delete",
                              label: `${t("common.delete")} ${row.title}`,
                              icon: Trash2,
                              tone: "destructive",
                              onClick: () => setToDelete(row),
                              disabled: actions.isPending,
                            },
                          ]
                    }
                  />
                )
              : undefined
          }
          emptyState={
            <EmptyState
              icon={CalendarDays}
              title={t("attendance.calendar.empty")}
              compact
              variant="dashed"
            />
          }
        />
      )}

      {canWrite ? (
        <CalendarEventFormModal
          open={modalOpen}
          entry={editing}
          initialDate={initialDate}
          isPending={actions.isPending}
          onClose={() => setModalOpen(false)}
          onSave={async (body) => (await actions.save(editing?.id, body)) !== null}
        />
      ) : null}

      {canWrite ? (
        <CalendarCopyFromSessionDialog
          open={copyOpen}
          isPending={actions.isPending}
          onClose={() => setCopyOpen(false)}
          onCopy={actions.saveMany}
        />
      ) : null}

      <ConfirmAlertDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={t("attendance.calendar.deleteTitle")}
        description={
          toDelete ? t("attendance.calendar.deleteConfirm", { name: toDelete.title }) : ""
        }
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        destructive
        onConfirm={async () => {
          if (toDelete) await actions.remove(toDelete);
          setToDelete(null);
        }}
      />
    </div>
  );
}
