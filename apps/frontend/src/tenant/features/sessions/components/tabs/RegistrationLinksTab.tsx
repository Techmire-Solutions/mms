import React, { useState } from "react";
import { Copy, ExternalLink, Link2, Pencil, Plus, Trash2 } from "lucide-react";
import { formatDate, type RegistrationLink, type Session } from "@mms/shared";
import {
  DataTable,
  DataTableRowActions,
  type DataTableColumn,
} from "@/components/common/data-table";
import { Button } from "@/components/ui/button";
import { ConfirmAlertDialog } from "@/components/app/ConfirmAlertDialog";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { StatusBadge, type StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import { SEMANTIC_BADGE } from "@/lib/ui/semanticTone";
import { useTranslation } from "@/hooks/useTranslation";
import {
  registrationLinkUrl,
  useRegistrationLinkActions,
  useRegistrationLinks,
} from "@/tenant/features/sessions/hooks/useRegistrationLinks";
import { RegistrationLinkFormModal } from "./RegistrationLinkFormModal";

export interface RegistrationLinksTabProps {
  session: Session;
  canWrite: boolean;
}

/** Session detail → Registration: public links applicants use to apply for this session. */
export function RegistrationLinksTab({
  session,
  canWrite,
}: RegistrationLinksTabProps): React.JSX.Element {
  const { t } = useTranslation();
  const query = useRegistrationLinks(session.id);
  const actions = useRegistrationLinkActions(session.id);
  const [editing, setEditing] = useState<RegistrationLink | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [toDelete, setToDelete] = useState<RegistrationLink | null>(null);
  const classNames = new Map(session.classes.map((cls) => [cls.id, cls.name]));

  const statusConfig: Record<string, StatusBadgeConfigItem> = {
    active: { label: t("sessions.registration.statusActive"), cls: SEMANTIC_BADGE.success },
    paused: { label: t("sessions.registration.statusPaused"), cls: SEMANTIC_BADGE.muted },
  };
  const badge = (row: RegistrationLink) => (
    <StatusBadge status={row.isActive ? "active" : "paused"} config={statusConfig} size="sm" />
  );
  const openEditor = (row: RegistrationLink | null) => {
    setEditing(row);
    setModalOpen(true);
  };

  const columns: DataTableColumn<RegistrationLink>[] = [
    {
      id: "title",
      label: t("sessions.registration.title"),
      fixed: true,
      render: (row) => <span className="font-medium">{row.title || session.name}</span>,
    },
    {
      id: "classes",
      label: t("sessions.registration.classesColumn"),
      width: 200,
      render: (row) =>
        row.classIds.length === 0
          ? t("sessions.registration.allClasses")
          : row.classIds.map((id) => classNames.get(id) ?? id).join(", "),
    },
    {
      id: "closes",
      label: t("sessions.registration.closesOn"),
      width: 140,
      render: (row) => (row.closesAt ? formatDate(row.closesAt) : "—"),
    },
    {
      id: "submissions",
      label: t("sessions.registration.submissions"),
      width: 130,
      render: (row) =>
        row.maxSubmissions
          ? `${row.submissionCount} / ${row.maxSubmissions}`
          : String(row.submissionCount),
    },
    { id: "status", label: t("common.status"), width: 120, render: badge },
  ];

  if (query.isError)
    return (
      <ErrorState
        title={t("sessions.registration.loadFailed")}
        onRetry={() => void query.refetch()}
      />
    );

  return (
    <div className="space-y-3">
      <p className="text-pretty text-sm text-muted-foreground">{t("sessions.registration.hint")}</p>
      <DataTable
        tableId="sessions.detail.registrationLinks"
        label={t("sessions.registration.tableLabel")}
        data={query.data ?? []}
        columns={columns}
        isLoading={query.isLoading}
        card={{ title: (row) => row.title || session.name, badge }}
        primaryAction={
          canWrite ? (
            <Button type="button" size="sm" className="min-h-11" onClick={() => openEditor(null)}>
              <Plus className="size-4" aria-hidden />
              {t("sessions.registration.add")}
            </Button>
          ) : undefined
        }
        renderRowActions={(row) => (
          <DataTableRowActions
            actions={[
              {
                id: "copy",
                label: `${t("sessions.registration.copy")} ${row.title || session.name}`,
                icon: Copy,
                onClick: () => void actions.copy(row),
              },
              {
                id: "open",
                label: `${t("sessions.registration.open")} ${row.title || session.name}`,
                icon: ExternalLink,
                onClick: () => window.open(registrationLinkUrl(row), "_blank", "noopener"),
              },
              ...(canWrite
                ? [
                    {
                      id: "edit",
                      label: `${t("common.edit")} ${row.title || session.name}`,
                      icon: Pencil,
                      onClick: () => openEditor(row),
                      disabled: actions.isPending,
                    },
                    {
                      id: "delete",
                      label: `${t("common.delete")} ${row.title || session.name}`,
                      icon: Trash2,
                      tone: "destructive" as const,
                      onClick: () => setToDelete(row),
                      disabled: actions.isPending,
                    },
                  ]
                : []),
            ]}
          />
        )}
        emptyState={
          <EmptyState
            icon={Link2}
            title={t("sessions.registration.empty")}
            compact
            variant="dashed"
          />
        }
      />
      {canWrite ? (
        <RegistrationLinkFormModal
          open={modalOpen}
          session={session}
          entry={editing}
          isPending={actions.isPending}
          onClose={() => setModalOpen(false)}
          onSave={async (body) => (await actions.save(editing?.id, body)) !== null}
        />
      ) : null}
      <ConfirmAlertDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={t("sessions.registration.deleteTitle")}
        description={t("sessions.registration.deleteConfirm")}
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
