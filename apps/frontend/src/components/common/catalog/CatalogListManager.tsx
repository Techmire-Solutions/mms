import React, { useState } from "react";
import { ListChecks, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import type { AcademicCatalogItem, AcademicCatalogKind } from "@mms/shared";
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
import { ModuleTrashToggle } from "@/components/app/ModuleTrashToggle";
import { SEMANTIC_BADGE } from "@/lib/ui/semanticTone";
import { useTranslation } from "@/hooks/useTranslation";
import { useAcademicCatalogActions, useAcademicCatalogItems } from "@/hooks/useAcademicCatalog";
import { CatalogItemFormModal } from "./CatalogItemFormModal";

export interface CatalogListManagerProps {
  kind: AcademicCatalogKind;
  canWrite: boolean;
  /** Trash view (show deleted + restore) needs delete permission. */
  canDelete?: boolean;
}

/** Setup directory for one academic catalog: list, add/edit, archive, delete, restore. */
export function CatalogListManager({
  kind,
  canWrite,
  canDelete = false,
}: CatalogListManagerProps): React.JSX.Element {
  const { t } = useTranslation();
  const [showDeleted, setShowDeleted] = useState(false);
  const [editing, setEditing] = useState<AcademicCatalogItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [toDelete, setToDelete] = useState<AcademicCatalogItem | null>(null);
  const query = useAcademicCatalogItems(kind, { includeDeleted: canDelete && showDeleted });
  const actions = useAcademicCatalogActions(kind);
  const rows = query.data ?? [];
  const item = t(`academicCatalog.kind.${kind}.singular`);
  const items = t(`academicCatalog.kind.${kind}.title`);

  const statusConfig: Record<string, StatusBadgeConfigItem> = {
    active: { label: t("academicCatalog.status.active"), cls: SEMANTIC_BADGE.success },
    archived: { label: t("academicCatalog.status.archived"), cls: SEMANTIC_BADGE.muted },
    deleted: { label: t("academicCatalog.deleted"), cls: SEMANTIC_BADGE.destructive },
  };
  const statusOf = (row: AcademicCatalogItem) => (row.deletedAt ? "deleted" : row.status);
  const badge = (row: AcademicCatalogItem) => (
    <StatusBadge status={statusOf(row)} config={statusConfig} size="sm" />
  );

  const columns: DataTableColumn<AcademicCatalogItem>[] = [
    {
      id: "name",
      label: t("academicCatalog.name"),
      fixed: true,
      render: (row) => (
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium">{row.name}</span>
          {row.isSystem ? (
            <span className="text-xs text-muted-foreground">{t("academicCatalog.system")}</span>
          ) : null}
        </span>
      ),
    },
    {
      id: "shortName",
      label: t("academicCatalog.shortName"),
      width: 140,
      render: (row) => row.shortName ?? "—",
    },
    {
      id: "code",
      label: t("academicCatalog.code"),
      width: 160,
      defaultHidden: true,
      render: (row) => row.code ?? "—",
    },
    {
      id: "status",
      label: t("common.status"),
      width: 130,
      searchValue: (row) => statusConfig[statusOf(row)].label,
      render: badge,
    },
  ];

  const openEditor = (row: AcademicCatalogItem | null) => {
    setEditing(row);
    setModalOpen(true);
  };

  if (query.isError) {
    return (
      <ErrorState
        title={t("academicCatalog.loadFailed", { items })}
        onRetry={() => void query.refetch()}
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t(`academicCatalog.kind.${kind}.hint`)}</p>
      <DataTable
        tableId={`sessions.setup.${kind}`}
        label={items}
        data={rows}
        columns={columns}
        isLoading={query.isLoading}
        searchPlaceholder={t("academicCatalog.search", { items })}
        card={{ title: (row) => row.name, badge }}
        rowClassName={(row) =>
          row.status === "active" && !row.deletedAt ? undefined : "opacity-70"
        }
        primaryAction={
          canWrite ? (
            <Button type="button" size="sm" onClick={() => openEditor(null)} className="min-h-11">
              <Plus className="size-4" aria-hidden />
              {t("academicCatalog.add", { item })}
            </Button>
          ) : undefined
        }
        toolbarExtras={
          canDelete ? (
            <ModuleTrashToggle
              showDeleted={showDeleted}
              onToggle={() => setShowDeleted((value) => !value)}
              showDeletedLabel={t("academicCatalog.showDeleted")}
              showActiveLabel={t("academicCatalog.status.active")}
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
                            label: `${t("academicCatalog.restore")} ${row.name}`,
                            icon: RotateCcw,
                            onClick: () => void actions.restore(row),
                            disabled: actions.isPending,
                          },
                        ]
                      : [
                          {
                            id: "edit",
                            label: `${t("common.edit")} ${row.name}`,
                            icon: Pencil,
                            onClick: () => openEditor(row),
                            disabled: actions.isPending,
                          },
                          {
                            id: "delete",
                            label: `${t("common.delete")} ${row.name}`,
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
            icon={ListChecks}
            title={t("academicCatalog.empty", { items })}
            compact
            variant="dashed"
          />
        }
      />

      {canWrite ? (
        <CatalogItemFormModal
          open={modalOpen}
          kind={kind}
          entry={editing}
          existing={rows}
          isPending={actions.isPending}
          onClose={() => setModalOpen(false)}
          onSave={async (body) => (await actions.save(editing?.id, body)) !== null}
        />
      ) : null}

      <ConfirmAlertDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={t("academicCatalog.deleteTitle", { item })}
        description={toDelete ? t("academicCatalog.deleteConfirm", { name: toDelete.name }) : ""}
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
