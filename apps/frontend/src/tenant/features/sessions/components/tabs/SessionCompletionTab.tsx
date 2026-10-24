import React from "react";
import { Award, Printer, RefreshCw } from "lucide-react";
import {
  formatDate,
  todayISO,
  type AppTranslationKey,
  type CompletionShortfall,
  type Session,
  type SessionCompletionRow,
} from "@mms/shared";
import {
  DataTable,
  DataTableRowActions,
  type DataTableColumn,
} from "@/components/common/data-table";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/app/ErrorState";
import { StatusBadge, type StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import { SEMANTIC_BADGE } from "@/lib/ui/semanticTone";
import { printHtmlDocument } from "@/lib/ui/printHtmlDocument";
import { useBrandPalette } from "@/lib/contexts/BrandingPaletteContext";
import { useTranslation } from "@/hooks/useTranslation";
import {
  useSessionCompletion,
  useSessionCompletionActions,
} from "@/tenant/features/sessions/hooks/useSessionCompletion";
import { completionCertificateHtml } from "@/lib/ui/completionCertificateHtml";

type CompletionTableRow = SessionCompletionRow & { id: string };

const SHORTFALL_LABEL: Record<CompletionShortfall, AppTranslationKey> = {
  attendance_below: "sessions.completion.shortfall.attendanceBelow",
  attendance_unknown: "sessions.completion.shortfall.attendanceUnknown",
  exam_not_passed: "sessions.completion.shortfall.examNotPassed",
  exam_missing: "sessions.completion.shortfall.examMissing",
};

/** Session detail → Completion: who met the course criteria, and their certificates. */
export function SessionCompletionTab({
  session,
  canWrite,
}: {
  session: Session;
  canWrite: boolean;
}): React.JSX.Element {
  const { t } = useTranslation();
  const { primary } = useBrandPalette();
  const query = useSessionCompletion(String(session.id));
  const actions = useSessionCompletionActions(String(session.id));
  const rows: CompletionTableRow[] = (query.data ?? []).map((row) => ({
    ...row,
    id: row.enrollmentId,
  }));
  const completed = rows.filter((row) => row.status === "completed");

  const statusConfig: Record<string, StatusBadgeConfigItem> = {
    completed: { label: t("sessions.completion.status.completed"), cls: SEMANTIC_BADGE.success },
    not_completed: {
      label: t("sessions.completion.status.notCompleted"),
      cls: SEMANTIC_BADGE.warning,
    },
  };
  const badge = (row: SessionCompletionRow) => (
    <StatusBadge status={row.status} config={statusConfig} size="sm" />
  );
  const print = (targets: SessionCompletionRow[]) => {
    const period = `${formatDate(session.startDate)} – ${formatDate(session.endDate)}`;
    const html = targets
      .map((row) =>
        completionCertificateHtml({
          heading: t("sessions.completion.certificate.heading"),
          statement: t("sessions.completion.certificate.statement"),
          recipientName: row.studentName,
          courseName: session.name,
          period,
          issuedLabel: t("sessions.completion.certificate.issuedOn"),
          issuedOn: row.certificateIssuedAt?.slice(0, 10) || todayISO(),
          accent: primary,
        }),
      )
      .join("");
    printHtmlDocument(t("sessions.completion.certificate.heading"), html);
  };
  const issueAndPrint = async (targets: SessionCompletionRow[]) => {
    const pending = targets
      .filter((row) => !row.certificateIssuedAt)
      .map((row) => row.enrollmentId);
    if (pending.length > 0) await actions.issueCertificates(pending);
    print(targets);
  };

  const columns: DataTableColumn<CompletionTableRow>[] = [
    {
      id: "student",
      label: t("sessions.completion.student"),
      fixed: true,
      render: (row) => <span className="font-medium">{row.studentName}</span>,
    },
    {
      id: "class",
      label: t("sessions.completion.class"),
      width: 140,
      render: (row) => row.className,
    },
    {
      id: "attendance",
      label: t("sessions.completion.attendance"),
      width: 120,
      render: (row) => (row.attendancePct === null ? "—" : `${row.attendancePct}%`),
    },
    {
      id: "exam",
      label: t("sessions.completion.exam"),
      width: 120,
      render: (row) =>
        row.examsPassed === null
          ? "—"
          : row.examsPassed
            ? t("sessions.completion.examPassed")
            : t("sessions.completion.examNotPassed"),
    },
    { id: "status", label: t("common.status"), width: 140, render: badge },
    {
      id: "shortfalls",
      label: t("sessions.completion.shortfalls"),
      width: 220,
      render: (row) => row.shortfalls.map((code) => t(SHORTFALL_LABEL[code])).join(" ") || "—",
    },
    {
      id: "certificate",
      label: t("sessions.completion.certificateColumn"),
      width: 140,
      render: (row) => (row.certificateIssuedAt ? formatDate(row.certificateIssuedAt) : "—"),
    },
  ];

  if (query.isError)
    return (
      <ErrorState
        title={t("sessions.completion.loadFailed")}
        onRetry={() => void query.refetch()}
      />
    );

  return (
    <div className="space-y-3">
      <p className="text-pretty text-sm text-muted-foreground">
        {session.minAttendancePct || session.requiresExamPass
          ? t("sessions.completion.criteriaSummary", {
              attendance: session.minAttendancePct ? `${session.minAttendancePct}%` : "—",
              exam: session.requiresExamPass ? t("common.yes") : t("common.no"),
            })
          : t("sessions.completion.noCriteria")}
      </p>
      <DataTable
        tableId="sessions.detail.completion"
        label={t("sessions.completion.tableLabel")}
        data={rows}
        columns={columns}
        isLoading={query.isLoading}
        card={{ title: (row) => row.studentName, badge }}
        primaryAction={
          canWrite ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-11 gap-1.5"
                disabled={actions.isPending}
                onClick={() => void actions.evaluate()}
              >
                <RefreshCw className="size-4" aria-hidden />
                {t("sessions.completion.evaluate")}
              </Button>
              <Button
                type="button"
                size="sm"
                className="min-h-11 gap-1.5"
                disabled={actions.isPending || completed.length === 0}
                onClick={() => void issueAndPrint(completed)}
              >
                <Award className="size-4" aria-hidden />
                {t("sessions.completion.issueAll", { count: completed.length })}
              </Button>
            </div>
          ) : undefined
        }
        renderRowActions={(row) =>
          row.status === "completed" && (canWrite || row.certificateIssuedAt) ? (
            <DataTableRowActions
              actions={[
                {
                  id: "print",
                  label: `${t("sessions.completion.printCertificate")} ${row.studentName}`,
                  icon: Printer,
                  onClick: () => void (canWrite ? issueAndPrint([row]) : print([row])),
                  disabled: actions.isPending,
                },
              ]}
            />
          ) : null
        }
      />
    </div>
  );
}
