import React, { useState } from "react";
import { CheckCheck, CircleCheck, CircleX, Clock3, Search } from "lucide-react";
import {
  formatDate,
  REGISTRATION_APPLICATION_STATUSES,
  SEAT_AVAILABLE_REVIEW_NOTE,
  type RegistrationApplication,
  type RegistrationApplicationStatus,
} from "@mms/contracts";
import {
  DataTable,
  DataTableRowActions,
  type DataTableColumn,
} from "@mms/fe-core/components/data-table";
import { Button } from "@mms/ui";
import { EmptyState } from "@mms/ui";
import { ErrorState } from "@mms/fe-core/components/ErrorState";
import { Field, FormSelect } from "@mms/fe-core/components/FormPrimitives";
import { Input } from "@mms/ui";
import { FORM_INPUT } from "@mms/ui";
import { ListPagination } from "@mms/fe-core/components/ListPagination";
import { StatusBadge } from "@mms/fe-core/components/StatusBadge";
import { Badge } from "@mms/ui";
import { useTranslation } from "@mms/fe-core/i18n";
import { useAcademicTerms } from "../../host/useAcademicTerms";
import { useSessionsCollection } from "../../host/sessionsCollection";
import { useAdmissionsList, useAdmissionsReview } from "../../hooks/useAdmissions";
import { AdmissionsMetricsGrid } from "./AdmissionsMetricsGrid";
import { AdmissionsDecisionModal, type AdmissionsDecision } from "./AdmissionsDecisionModal";
import { admissionsStatusConfig } from "./admissionsStatusConfig";

const PAGE_SIZE = 25;

/** Enrollments → Work → Admissions: review public registrations and turn them into enrollments. */
export function AdmissionsPanel({ canWrite }: { canWrite: boolean }): React.JSX.Element {
  const { t } = useTranslation();
  const terms = useAcademicTerms();
  const sessions = useSessionsCollection();
  const [sessionId, setSessionId] = useState("");
  const [status, setStatus] = useState<RegistrationApplicationStatus | "">("submitted");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<{
    decision: AdmissionsDecision;
    apps: RegistrationApplication[];
  } | null>(null);
  const list = useAdmissionsList({
    sessionId: sessionId || undefined,
    status: status || undefined,
    search: search.trim() || undefined,
    page,
    limit: PAGE_SIZE,
  });
  const { review, isPending } = useAdmissionsReview();
  const statusConfig = admissionsStatusConfig(t);
  const statusCell = (row: RegistrationApplication) => (
    <span className="inline-flex items-center gap-1.5">
      <StatusBadge status={row.status} config={statusConfig} size="sm" />
      {row.status === "waitlisted" && row.waitlistPosition != null ? (
        <Badge
          pill
          tone="info"
          aria-label={t("enrollments.admissions.position", { position: row.waitlistPosition })}
        >
          #{row.waitlistPosition}
        </Badge>
      ) : null}
    </span>
  );
  const rows = list.data?.items ?? [];
  const approvable = rows.filter(
    (row: any) =>
      (row.status === "submitted" || row.status === "under_review") &&
      row.eligibilityReasons.length === 0,
  );

  const columns: DataTableColumn<RegistrationApplication>[] = [
    {
      id: "name",
      kind: "identity",
      label: t("enrollments.admissions.applicant"),
      fixed: true,
      render: (row: any) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{row.fullName}</span>
          <span className="font-mono text-2xs text-muted-foreground" dir="ltr">
            {row.reference}
          </span>
        </span>
      ),
    },
    {
      id: "class",
      label: terms.class.singular,
      width: 180,
      render: (row: any) => `${row.className} · ${row.sessionName}`,
    },
    {
      id: "dob",
      label: t("apply.dateOfBirth"),
      width: 130,
      render: (row: any) => formatDate(row.dateOfBirth),
    },
    {
      id: "phone",
      label: t("apply.phone"),
      width: 150,
      render: (row: any) => <span dir="ltr">{row.phone}</span>,
    },
    {
      id: "flags",
      label: t("enrollments.admissions.checks"),
      width: 200,
      render: (row: any) =>
        row.eligibilityReasons.length > 0 ? (
          <span className="text-xs text-destructive">
            {row.eligibilityReasons
              .map((reason: any) => t(`apply.reasons.${reason}` as any))
              .join(" ")}
          </span>
        ) : row.reviewReason === SEAT_AVAILABLE_REVIEW_NOTE ? (
          <span className="text-xs font-medium text-success">
            {t("enrollments.admissions.seatAvailable")}
          </span>
        ) : row.matchedStudentId ? (
          <span className="text-xs text-info">{t("enrollments.admissions.possibleMatch")}</span>
        ) : (
          "—"
        ),
    },
    {
      id: "status",
      label: t("common.status"),
      width: 130,
      render: statusCell,
    },
  ];

  if (list.isError)
    return (
      <ErrorState
        title={t("enrollments.admissions.loadFailed")}
        onRetry={() => void list.refetch()}
      />
    );

  return (
    <div className="space-y-4">
      <AdmissionsMetricsGrid sessionId={sessionId || undefined} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field id="admissions-session" label={terms.session.singular}>
          <FormSelect
            id="admissions-session"
            name="sessionId"
            value={sessionId}
            placeholder={t("common.all")}
            onChange={(value) => {
              setSessionId(value);
              setPage(1);
            }}
            options={sessions.map((row: any) => ({ value: row.id, label: row.name }))}
          />
        </Field>
        <Field id="admissions-status" label={t("common.status")}>
          <FormSelect
            id="admissions-status"
            name="status"
            value={status}
            placeholder={t("common.all")}
            onChange={(value) => {
              setStatus(
                (REGISTRATION_APPLICATION_STATUSES as readonly string[]).includes(value)
                  ? (value as RegistrationApplicationStatus)
                  : "",
              );
              setPage(1);
            }}
            options={REGISTRATION_APPLICATION_STATUSES.map((value) => ({
              value,
              label: statusConfig[value].label,
            }))}
          />
        </Field>
        <Field id="admissions-search" label={t("enrollments.admissions.search")}>
          <Input
            id="admissions-search"
            name="search"
            type="search"
            className={FORM_INPUT}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </Field>
      </div>
      <DataTable
        tableId="enrollments.admissions"
        label={t("enrollments.admissions.title")}
        data={rows}
        columns={columns}
        isLoading={list.isLoading}
        card={{
          title: (row: any) => row.fullName,
          badge: statusCell,
        }}
        primaryAction={
          canWrite && approvable.length > 0 ? (
            <Button
              type="button"
              size="sm"
              className="min-h-11"
              disabled={isPending}
              onClick={() => setPending({ decision: "approve", apps: approvable })}
            >
              <CheckCheck className="size-4" aria-hidden />
              {t("enrollments.admissions.approveEligible", { count: approvable.length })}
            </Button>
          ) : undefined
        }
        renderRowActions={
          canWrite
            ? (row: any) =>
                row.status === "approved" ? null : (
                  <DataTableRowActions
                    actions={[
                      {
                        id: "approve",
                        label: `${t("enrollments.admissions.decision.approve")} ${row.fullName}`,
                        icon: CircleCheck,
                        onClick: () => setPending({ decision: "approve", apps: [row] }),
                        disabled: isPending,
                      },
                      {
                        id: "waitlist",
                        label: `${t("enrollments.admissions.decision.waitlist")} ${row.fullName}`,
                        icon: Clock3,
                        onClick: () => setPending({ decision: "waitlist", apps: [row] }),
                        disabled: isPending || row.status === "waitlisted",
                      },
                      {
                        id: "reject",
                        label: `${t("enrollments.admissions.decision.reject")} ${row.fullName}`,
                        icon: CircleX,
                        tone: "destructive",
                        onClick: () => setPending({ decision: "reject", apps: [row] }),
                        disabled: isPending,
                      },
                    ]}
                  />
                )
            : undefined
        }
        emptyState={
          <EmptyState
            icon={Search}
            title={t("enrollments.admissions.empty")}
            compact
            variant="dashed"
          />
        }
      />
      <ListPagination
        page={page}
        total={list.data?.total ?? 0}
        limit={PAGE_SIZE}
        onPageChange={setPage}
      />
      {canWrite ? (
        <AdmissionsDecisionModal
          open={Boolean(pending)}
          decision={pending?.decision ?? "approve"}
          applications={pending?.apps ?? []}
          isPending={isPending}
          onClose={() => setPending(null)}
          onConfirm={review}
        />
      ) : null}
    </div>
  );
}
