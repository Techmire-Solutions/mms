import React, { useState, useEffect, useCallback } from "react";
import { formatDateTime, todayISO } from "@mms/shared";
import { EmptyState } from "@/components/ui/EmptyState";
import { ClipboardList, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/DatePicker";
import { getAuditLog } from "@/tenant/features/attendance/components/MarkAttendance";
import { useSessionsCollection } from "@/tenant/hooks/collections/sessions";
import { type WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import { type AttendanceFilterState } from "@/tenant/features/attendance/components/AttendanceFilters";
import { useTranslation } from "@/hooks/useTranslation";
import { FormSelect } from "@/components/ui/FormSelect";
import { reportClientError } from "@/lib/clientErrorReporting";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  DataTable,
  type DataTableColumn,
  type DataTableFilter,
} from "@/components/common/data-table";
import { useStudentsByIds } from "@/tenant/hooks/collections/students";
import { uniqueRegistryIds } from "@/lib/registryResolve";
import {
  type AuditEntry,
  describeAuditEntry,
  buildAuditActionConfig,
} from "@/tenant/features/attendance/components/auditLogFormatters";

export type { AuditEntry };

export interface AuditLogProps {
  filters: Partial<AttendanceFilterState>;
  viewMode?: WorkDirectoryViewMode;
}

interface AuditLogRow {
  id: number;
  entry: AuditEntry;
}

/**
 * AuditLog
 *
 * Displays a log of actions taken regarding attendance (e.g., editing, bulk marking).
 * Allows filtering by class and date.
 */
export function AuditLog({ filters, viewMode }: AuditLogProps): React.JSX.Element {
  const { t } = useTranslation();
  const sessions = useSessionsCollection();
  const [log, setLog] = useState<AuditEntry[]>([]);
  const studentIds = uniqueRegistryIds(log.map((entry) => entry.studentId));
  const { data: students = [] } = useStudentsByIds(studentIds);
  const actionConfig = buildAuditActionConfig(t);

  const studentMap = (() => {
    const map = new Map<string, string>();
    for (const student of students) {
      if (student?.id != null && student.name) {
        map.set(String(student.id), student.name);
      }
    }
    return map;
  })();

  const studentNameFor = (id?: string): string => {
    if (!id) return "";
    return studentMap.get(String(id)) ?? "";
  };

  const allClasses = sessions.flatMap((session) =>
    (session.classes || []).map((sessionClass) => ({
      ...sessionClass,
      sessionId: session.id,
      sessionName: session.name,
    })),
  );

  const [classId, setClassId] = useState(filters.classId || "");
  const [date, setDate] = useState(filters.date || todayISO());

  const reload = useCallback(() => {
    try {
      const result = getAuditLog(classId, date);
      setLog(Array.isArray(result) ? result : []);
    } catch (error) {
      reportClientError(error, { context: "attendance.loadAuditLog" });
      setLog([]);
    }
  }, [classId, date]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (filters.classId) setClassId(filters.classId);
    if (filters.date) setDate(filters.date);
  }, [filters.classId, filters.date]);

  const rows: AuditLogRow[] = log.map((entry, index) => ({ id: index, entry }));
  const actionLabel = (row: AuditLogRow) =>
    actionConfig[row.entry.action]?.label ?? row.entry.action;
  const columns: DataTableColumn<AuditLogRow>[] = [
    {
      id: "time",
      label: t("attendance.audit.colTime"),
      width: 180,
      noWrap: true,
      searchValue: (row) => formatDateTime(row.entry.ts),
      render: (row) => (
        <span className="text-xs font-mono text-muted-foreground">
          {formatDateTime(row.entry.ts)}
        </span>
      ),
    },
    {
      id: "action",
      label: t("attendance.audit.colAction"),
      noWrap: true,
      searchValue: actionLabel,
      hideInCard: true,
      render: (row) => <StatusBadge status={row.entry.action} config={actionConfig} size="sm" />,
    },
    {
      id: "details",
      label: t("attendance.audit.colDetails"),
      fixed: true,
      hideInCard: true,
      searchValue: (row) => describeAuditEntry(row.entry, studentNameFor, t),
      render: (row) => (
        <span className="text-xs text-foreground">
          {describeAuditEntry(row.entry, studentNameFor, t)}
        </span>
      ),
    },
    {
      id: "by",
      label: t("attendance.audit.colBy"),
      noWrap: true,
      searchValue: (row) => row.entry.by,
      render: (row) => (
        <span className="text-xs font-semibold text-muted-foreground capitalize">
          {row.entry.by || "—"}
        </span>
      ),
    },
  ];
  const tableFilters: DataTableFilter<AuditLogRow>[] = [
    {
      id: "action",
      label: t("attendance.audit.colAction"),
      options: Object.entries(actionConfig).map(([value, item]) => ({ value, label: item.label })),
      getValue: (row) => row.entry.action,
    },
  ];

  return (
    <section className="space-y-4">
      <SectionHeader
        layout="row"
        icon={<ClipboardList className="w-4 h-4 text-primary" aria-hidden="true" />}
        title={t("attendance.audit.title")}
        badge={
          <span className="text-xs text-muted-foreground">
            {t("attendance.audit.entriesCount", { count: log.length })}
          </span>
        }
        actions={
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={reload}
            aria-label={t("attendance.audit.reload")}
            className="text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        }
      />

      <DataTable
        tableId="attendance.auditLog"
        defaultViewMode={viewMode}
        label={t("attendance.audit.title")}
        data={rows}
        columns={columns}
        filters={tableFilters}
        card={{
          title: (row) => describeAuditEntry(row.entry, studentNameFor, t),
          badge: (row) => <StatusBadge status={row.entry.action} config={actionConfig} size="sm" />,
        }}
        toolbarExtras={
          <>
            <label htmlFor="audit-class-select" className="sr-only">
              {t("attendance.audit.filterClass")}
            </label>
            <FormSelect
              id="audit-class-select"
              value={classId}
              onChange={setClassId}
              placeholder={t("attendance.audit.allClasses")}
              options={allClasses.map((sessionClass) => ({
                value: sessionClass.id,
                label: sessionClass.name,
              }))}
              className="text-sm min-w-audit-action"
            />
            <DatePicker
              id="audit-date-select"
              name="auditDate"
              value={date}
              onChange={setDate}
              aria-label={t("attendance.filters.date")}
              className="text-sm"
            />
          </>
        }
        emptyState={
          <EmptyState
            variant="dashed"
            icon={ClipboardList}
            title={t("attendance.audit.emptyTitle")}
            description={t("attendance.audit.emptyDesc")}
            compact
          />
        }
      />
    </section>
  );
}
