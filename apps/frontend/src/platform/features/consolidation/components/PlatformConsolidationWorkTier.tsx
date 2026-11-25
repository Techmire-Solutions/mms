import React, { useState } from "react";
import { Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@mms/ui";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { EmptyState } from "@mms/ui";
import { ErrorState } from "@/components/app/ErrorState";
import { SectionCard } from "@mms/ui";
import { useTranslation } from "@mms/fe-core/i18n";
import { notify } from "@mms/fe-core/notify";
import { ConsolidationGroupForm } from "@/platform/features/consolidation/components/ConsolidationGroupForm";
import { ConsolidationGroupDetailDrawer } from "@mms/mod-accounting/frontend/platform";
import {
  useConsolidationGroups,
  useDeleteConsolidationGroup,
} from "@/platform/features/consolidation/hooks/usePlatformConsolidation";
import type { ConsolidationGroup } from "@mms/contracts";

/** Consolidation → Work: consolidation-group directory (DataTable + drawer + form). */
export function PlatformConsolidationWorkTier(): React.JSX.Element {
  const { t } = useTranslation();
  const groups = useConsolidationGroups();
  const remove = useDeleteConsolidationGroup();
  const [editing, setEditing] = useState<ConsolidationGroup | null | "new">(null);
  const [selected, setSelected] = useState<ConsolidationGroup | null>(null);

  const list = groups.data ?? [];

  const handleDelete = async (group: ConsolidationGroup): Promise<void> => {
    try {
      await remove.mutateAsync(group.id);
      notify.success(t("platform.consolidation.deleted"));
      setSelected(null);
    } catch (error) {
      notify.error(t("platform.consolidation.deleteFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const columns: DataTableColumn<ConsolidationGroup>[] = [
    {
      id: "name",
      kind: "identity",
      label: t("platform.consolidation.groupName"),
      render: (row) => row.name,
    },
    {
      id: "currency",
      kind: "code",
      label: t("platform.consolidation.presentationCurrency"),
      render: (row) => row.presentationCurrency,
    },
    {
      id: "members",
      kind: "number",
      label: t("platform.consolidation.members"),
      render: (row) => String(row.members.length),
    },
    {
      id: "updatedAt",
      kind: "date",
      label: t("platform.consolidation.updatedAt"),
      render: (row) => row.updatedAt ?? "—",
    },
    {
      id: "actions",
      width: 120,
      label: "",
      render: (row) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setEditing(row)}>
            {t("common.edit")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={Trash2}
            className="text-destructive"
            onClick={() => void handleDelete(row)}
          >
            {t("common.delete")}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4 text-start">
      <SectionCard title={t("platform.consolidation.groups")} icon={Layers}>
        <Button type="button" className="min-h-11" icon={Plus} onClick={() => setEditing("new")}>
          {t("platform.consolidation.newGroup")}
        </Button>
      </SectionCard>

      {groups.isError ? (
        <ErrorState
          description={t("platform.consolidation.loadFailed")}
          onRetry={() => void groups.refetch()}
        />
      ) : list.length === 0 && !groups.isPending ? (
        <EmptyState
          title={t("platform.consolidation.emptyTitle")}
          description={t("platform.consolidation.emptyDescription")}
        />
      ) : (
        <DataTable
          tableId="platform-consolidation-groups"
          label={t("platform.consolidation.groups")}
          data={list}
          columns={columns}
          onRowClick={(row) => setSelected(row)}
        />
      )}

      {selected && !editing ? (
        <ConsolidationGroupDetailDrawer
          group={selected}
          onClose={() => setSelected(null)}
          onEdit={(group) => {
            setSelected(null);
            setEditing(group);
          }}
          onDelete={() => void handleDelete(selected)}
        />
      ) : null}

      {editing ? (
        <ConsolidationGroupForm
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}
