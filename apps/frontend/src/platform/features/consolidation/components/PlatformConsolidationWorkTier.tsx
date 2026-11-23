import React, { useState } from "react";
import { Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@shared/ui";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { Field } from "@/components/app/FormPrimitives";
import { FormSelect } from "@/components/app/FormSelect";
import { SectionCard } from "@/components/app/SectionCard";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import { ConsolidationGroupForm } from "@/platform/features/consolidation/components/ConsolidationGroupForm";
import {
  useConsolidationGroups,
  useDeleteConsolidationGroup,
} from "@/platform/features/consolidation/hooks/usePlatformConsolidation";
import type { ConsolidationGroup } from "@mms/shared";

/** Consolidation → Work: manage consolidation groups (parent + members + rates). */
export function PlatformConsolidationWorkTier(): React.JSX.Element {
  const { t } = useTranslation();
  const groups = useConsolidationGroups();
  const remove = useDeleteConsolidationGroup();
  const [selectedId, setSelectedId] = useState<string>("");
  const [editing, setEditing] = useState<ConsolidationGroup | null | "new">(null);

  const list = groups.data ?? [];
  const selected = list.find((group) => group.id === selectedId) ?? list[0] ?? null;

  const handleDelete = async (group: ConsolidationGroup): Promise<void> => {
    try {
      await remove.mutateAsync(group.id);
      notify.success(t("platform.consolidation.deleted"));
      setSelectedId("");
    } catch (error) {
      notify.error(t("platform.consolidation.deleteFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  if (groups.isError) {
    return (
      <ErrorState
        description={t("platform.consolidation.loadFailed")}
        onRetry={() => void groups.refetch()}
      />
    );
  }

  if (list.length === 0 && !groups.isPending) {
    return (
      <EmptyState
        title={t("platform.consolidation.emptyTitle")}
        description={t("platform.consolidation.emptyDescription")}
        action={
          <Button type="button" className="min-h-11" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" aria-hidden="true" /> {t("platform.consolidation.newGroup")}
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4 text-start">
      <SectionCard title={t("platform.consolidation.groups")} icon={Layers}>
        <div className="flex flex-wrap items-end gap-3">
          <Field id="cons-group" label={t("platform.consolidation.group")}>
            <FormSelect
              id="cons-group"
              name="group"
              value={selected?.id ?? ""}
              onChange={setSelectedId}
              options={list.map((group) => ({
                value: group.id,
                label: `${group.name} (${group.presentationCurrency})`,
              }))}
            />
          </Field>
          <Button type="button" className="min-h-11" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" aria-hidden="true" /> {t("platform.consolidation.newGroup")}
          </Button>
          {selected ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => setEditing(selected)}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />{" "}
                {t("platform.consolidation.editGroup")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 min-w-11 text-destructive"
                aria-label={t("platform.consolidation.deleteGroup")}
                disabled={remove.isPending}
                onClick={() => void handleDelete(selected)}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </>
          ) : null}
        </div>
      </SectionCard>

      {editing ? (
        <ConsolidationGroupForm
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}
