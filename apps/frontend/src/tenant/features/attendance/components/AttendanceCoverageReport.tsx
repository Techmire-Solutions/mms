import React, { useMemo, useState } from "react";
import { CalendarX } from "lucide-react";
import { formatDate, isoWeekday, todayISO, WEEKDAY_NAMES } from "@mms/shared";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { DatePicker } from "@/components/app/DatePicker";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { Field } from "@/components/app/FormPrimitives";
import { ExportToolbar } from "@/components/app/ExportToolbar";
import { StatsSkeleton } from "@shared/ui";
import { useTranslation } from "@/hooks/useTranslation";
import { useAttendanceCoverage } from "@/tenant/features/attendance/hooks/useAttendanceCoverage";

export interface AttendanceCoverageReportProps {
  /** Narrows the report to one class; empty covers the whole workspace. */
  classId?: string;
}

/** A type alias, not an interface: the exporter takes `Record<string, unknown>` rows. */
type UnmarkedRow = {
  id: string;
  date: string;
  weekday: string;
};

/** First day of the current month, as `YYYY-MM-DD`. */
function monthStart(): string {
  return `${todayISO().slice(0, 7)}-01`;
}

/**
 * Attendance → Reports → Coverage: the teaching days nobody marked.
 *
 * Answers "which days are missing?" rather than "how many were present?", so a forgotten register
 * surfaces before the term's rates are read as fact.
 */
export function AttendanceCoverageReport({
  classId,
}: AttendanceCoverageReportProps): React.JSX.Element {
  const { t, language } = useTranslation();
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(todayISO);
  const coverage = useAttendanceCoverage({ from, to, classId });

  // Weekday names come from Intl, as in WorkingDaysPicker and the calendar month view, so no
  // parallel set of weekday translation keys has to be kept in step across en/ar/ur/fa.
  const weekdayNames = useMemo(() => {
    const format = new Intl.DateTimeFormat(language, { weekday: "long", timeZone: "UTC" });
    return WEEKDAY_NAMES.map((_, index) => format.format(Date.UTC(2023, 0, 1 + index)));
  }, [language]);

  const rows = useMemo<UnmarkedRow[]>(
    () =>
      coverage.unmarkedDays.map((date) => ({
        id: date,
        date,
        weekday: weekdayNames[isoWeekday(date)] ?? "",
      })),
    [coverage.unmarkedDays, weekdayNames],
  );

  const columns: DataTableColumn<UnmarkedRow>[] = [
    {
      id: "date",
      label: t("attendance.coverage.date"),
      fixed: true,
      render: (row) => <span className="font-medium">{formatDate(row.date)}</span>,
    },
    {
      id: "weekday",
      label: t("attendance.coverage.weekday"),
      width: 160,
      render: (row) => row.weekday,
    },
  ];

  if (coverage.isError) {
    return (
      <ErrorState
        title={t("attendance.coverage.loadFailed")}
        description={t("attendance.loadFailedHint")}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:max-w-xl">
        <Field label={t("attendance.coverage.from")} id="coverage-from">
          <DatePicker
            id="coverage-from"
            name="from"
            value={from}
            max={to || undefined}
            onChange={(value) => {
              setFrom(value);
              if (to && value > to) setTo(value);
            }}
          />
        </Field>
        <Field label={t("attendance.coverage.to")} id="coverage-to">
          <DatePicker
            id="coverage-to"
            name="to"
            value={to}
            min={from || undefined}
            holidays={coverage.unmarkedDays}
            onChange={setTo}
          />
        </Field>
      </div>

      <p aria-live="polite" className="text-sm text-muted-foreground">
        {t("attendance.coverage.summary", {
          unmarked: String(coverage.unmarkedDays.length),
          teaching: String(coverage.instructionalDayCount),
        })}
      </p>

      {coverage.isLoading ? (
        <StatsSkeleton count={3} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={CalendarX}
          title={t("attendance.coverage.allMarked")}
          description={t("attendance.coverage.allMarkedHint")}
        />
      ) : (
        <>
          <ExportToolbar
            title={t("attendance.coverage.title")}
            filename="attendance-not-marked"
            moduleId="attendance"
            columns={[
              { key: "date", header: t("attendance.coverage.date") },
              { key: "weekday", header: t("attendance.coverage.weekday") },
            ]}
            rows={rows}
            variant="compact"
          />
          <DataTable
            tableId="attendance.reports.coverage"
            label={t("attendance.coverage.title")}
            data={rows}
            columns={columns}
            searchPlaceholder={t("attendance.coverage.search")}
            card={{ title: (row) => formatDate(row.date) }}
          />
        </>
      )}
    </div>
  );
}
