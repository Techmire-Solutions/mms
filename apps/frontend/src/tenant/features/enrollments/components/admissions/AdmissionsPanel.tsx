import React, { useState } from "react";
import { CheckCheck, CircleCheck, CircleX, Clock3, Inbox, Search, UserCheck, Users } from "lucide-react";
import { formatDate, REGISTRATION_APPLICATION_STATUSES, type RegistrationApplication, type RegistrationApplicationStatus } from "@mms/shared";
import { DataTable, DataTableRowActions, type DataTableColumn } from "@/components/common/data-table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Field, FormSelect } from "@/components/ui/FormPrimitives";
import { Input } from "@/components/ui/input";
import { FORM_INPUT } from "@/components/ui/formStyles";
import { ListPagination } from "@/components/ui/ListPagination";
import { ModuleCommandMetricsGrid } from "@/components/ui/ModuleCommandMetricsGrid";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useTranslation } from "@/hooks/useTranslation";
import { useAcademicTerms } from "@/hooks/useAcademicTerms";
import { useSessionsCollection } from "@/tenant/hooks/collections/sessions";
import { useAdmissionsList, useAdmissionsMetrics, useAdmissionsReview } from "@/tenant/features/enrollments/hooks/useAdmissions";
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
  const [pending, setPending] = useState<{ decision: AdmissionsDecision; apps: RegistrationApplication[] } | null>(null);
  const list = useAdmissionsList({ sessionId: sessionId || undefined, status: status || undefined, search: search.trim() || undefined, page, limit: PAGE_SIZE });
  const metrics = useAdmissionsMetrics(sessionId || undefined);
  const { review, isPending } = useAdmissionsReview();
  const statusConfig = admissionsStatusConfig(t);
  const rows = list.data?.items ?? [];
  const approvable = rows.filter((row) => (row.status === "submitted" || row.status === "under_review") && row.eligibilityReasons.length === 0);
  const m = metrics.data;

  const columns: DataTableColumn<RegistrationApplication>[] = [
    { id: "name", label: t("enrollments.admissions.applicant"), fixed: true, render: (row) => (
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium">{row.fullName}</span>
        <span className="font-mono text-2xs text-muted-foreground" dir="ltr">{row.reference}</span>
      </span>
    ) },
    { id: "class", label: terms.class.singular, width: 180, render: (row) => `${row.className} · ${row.sessionName}` },
    { id: "dob", label: t("apply.dateOfBirth"), width: 130, render: (row) => formatDate(row.dateOfBirth) },
    { id: "phone", label: t("apply.phone"), width: 150, render: (row) => <span dir="ltr">{row.phone}</span> },
    { id: "flags", label: t("enrollments.admissions.checks"), width: 200, render: (row) => (
      row.eligibilityReasons.length > 0
        ? <span className="text-xs text-destructive">{row.eligibilityReasons.map((reason) => t(`apply.reasons.${reason}`)).join(" ")}</span>
        : row.matchedStudentId ? <span className="text-xs text-info">{t("enrollments.admissions.possibleMatch")}</span> : "—"
    ) },
    { id: "status", label: t("common.status"), width: 130, render: (row) => <StatusBadge status={row.status} config={statusConfig} size="sm" /> },
  ];

  if (list.isError) return <ErrorState title={t("enrollments.admissions.loadFailed")} onRetry={() => void list.refetch()} />;

  return (
    <div className="space-y-4">
      <ModuleCommandMetricsGrid items={[
        { key: "submitted", icon: Inbox, label: t("enrollments.admissions.metric.submitted"), value: m?.submitted ?? 0 },
        { key: "review", icon: Clock3, label: t("enrollments.admissions.metric.underReview"), value: m?.underReview ?? 0, accent: "warning" },
        { key: "waitlisted", icon: Users, label: t("enrollments.admissions.metric.waitlisted"), value: m?.waitlisted ?? 0 },
        { key: "enrolled", icon: UserCheck, label: t("enrollments.admissions.metric.enrolled"), value: m?.enrolled ?? 0, accent: "success" },
      ]} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field id="admissions-session" label={terms.session.singular}>
          <FormSelect id="admissions-session" name="sessionId" value={sessionId} placeholder={t("common.all")}
            onChange={(value) => { setSessionId(value); setPage(1); }} options={sessions.map((row) => ({ value: row.id, label: row.name }))} />
        </Field>
        <Field id="admissions-status" label={t("common.status")}>
          <FormSelect id="admissions-status" name="status" value={status} placeholder={t("common.all")}
            onChange={(value) => { setStatus((REGISTRATION_APPLICATION_STATUSES as readonly string[]).includes(value) ? (value as RegistrationApplicationStatus) : ""); setPage(1); }}
            options={REGISTRATION_APPLICATION_STATUSES.map((value) => ({ value, label: statusConfig[value].label }))} />
        </Field>
        <Field id="admissions-search" label={t("enrollments.admissions.search")}>
          <Input id="admissions-search" name="search" type="search" className={FORM_INPUT} value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        </Field>
      </div>
      <DataTable
        tableId="enrollments.admissions"
        label={t("enrollments.admissions.title")}
        data={rows}
        columns={columns}
        isLoading={list.isLoading}
        card={{ title: (row) => row.fullName, badge: (row) => <StatusBadge status={row.status} config={statusConfig} size="sm" /> }}
        primaryAction={canWrite && approvable.length > 0 ? (
          <Button type="button" size="sm" className="min-h-11" disabled={isPending} onClick={() => setPending({ decision: "approve", apps: approvable })}>
            <CheckCheck className="size-4" aria-hidden />
            {t("enrollments.admissions.approveEligible", { count: approvable.length })}
          </Button>
        ) : undefined}
        renderRowActions={canWrite ? (row) => (row.status === "approved" ? null : (
          <DataTableRowActions actions={[
            { id: "approve", label: `${t("enrollments.admissions.decision.approve")} ${row.fullName}`, icon: CircleCheck, onClick: () => setPending({ decision: "approve", apps: [row] }), disabled: isPending },
            { id: "waitlist", label: `${t("enrollments.admissions.decision.waitlist")} ${row.fullName}`, icon: Clock3, onClick: () => setPending({ decision: "waitlist", apps: [row] }), disabled: isPending || row.status === "waitlisted" },
            { id: "reject", label: `${t("enrollments.admissions.decision.reject")} ${row.fullName}`, icon: CircleX, tone: "destructive", onClick: () => setPending({ decision: "reject", apps: [row] }), disabled: isPending },
          ]} />
        )) : undefined}
        emptyState={<EmptyState icon={Search} title={t("enrollments.admissions.empty")} compact variant="dashed" />}
      />
      <ListPagination page={page} total={list.data?.total ?? 0} limit={PAGE_SIZE} onPageChange={setPage} />
      {canWrite ? (
        <AdmissionsDecisionModal open={Boolean(pending)} decision={pending?.decision ?? "approve"} applications={pending?.apps ?? []}
          isPending={isPending} onClose={() => setPending(null)} onConfirm={review} />
      ) : null}
    </div>
  );
}
