import React, { useState } from "react";
import { Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { todayISO, type ConsolidationGroup, type ConsolidationReportQuery } from "@mms/shared";
import { Button } from "@shared/ui";
import { DatePicker } from "@/components/app/DatePicker";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { Field } from "@/components/app/FormPrimitives";
import { FormSelect } from "@/components/app/FormSelect";
import { ModulePageShell } from "@/components/app/ModulePageShell";
import { SectionCard } from "@/components/app/SectionCard";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import { ConsolidationGroupForm } from "@/platform/components/consolidation/ConsolidationGroupForm";
import { ConsolidationReportView } from "@/platform/components/consolidation/ConsolidationReportView";
import {
  useConsolidationGroups,
  useConsolidationReport,
  useDeleteConsolidationGroup,
} from "@/platform/hooks/usePlatformConsolidation";

const startOfYear = (date: string) => `${date.slice(0, 4)}-01-01`;

export default function PlatformConsolidationPage(): React.JSX.Element {
  const { t } = useTranslation();
  const groups = useConsolidationGroups();
  const remove = useDeleteConsolidationGroup();
  const [selectedId, setSelectedId] = useState<string>("");
  const [editing, setEditing] = useState<ConsolidationGroup | null | "new">(null);
  const [dateTo, setDateTo] = useState(todayISO());
  const [dateFrom, setDateFrom] = useState(startOfYear(todayISO()));
  const [period, setPeriod] = useState<ConsolidationReportQuery | null>(null);

  const list = groups.data ?? [];
  const selected = list.find((group) => group.id === selectedId) ?? list[0] ?? null;
  const report = useConsolidationReport(selected?.id ?? null, period);

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

  return (
    <ModulePageShell
      seoTitle={`${t("platform.consolidation.title")} | ${t("platform.consoleTitle")}`}
      seoDescription={t("platform.consolidation.subtitle")}
      headerIcon={Layers}
      headerTitle={t("platform.consolidation.title")}
      headerSubtitle={t("platform.consolidation.subtitle")}
    >
      <div className="space-y-4">
        {groups.isError ? (
          <ErrorState description={t("platform.consolidation.loadFailed")} onRetry={() => void groups.refetch()} />
        ) : list.length === 0 && !groups.isPending ? (
          <EmptyState
            title={t("platform.consolidation.emptyTitle")}
            description={t("platform.consolidation.emptyDescription")}
            action={
              <Button type="button" className="min-h-11" onClick={() => setEditing("new")}>
                <Plus className="h-4 w-4" aria-hidden="true" /> {t("platform.consolidation.newGroup")}
              </Button>
            }
          />
        ) : (
          <SectionCard title={t("platform.consolidation.groups")} icon={Layers}>
            <div className="flex flex-wrap items-end gap-3">
              <Field id="cons-group" label={t("platform.consolidation.group")}>
                <FormSelect
                  id="cons-group"
                  name="group"
                  value={selected?.id ?? ""}
                  onChange={(value) => {
                    setSelectedId(value);
                    setPeriod(null);
                  }}
                  options={list.map((group) => ({ value: group.id, label: `${group.name} (${group.presentationCurrency})` }))}
                />
              </Field>
              <Field id="cons-from" label={t("platform.consolidation.dateFrom")}>
                <DatePicker id="cons-from" name="dateFrom" value={dateFrom} onChange={setDateFrom} />
              </Field>
              <Field id="cons-to" label={t("platform.consolidation.dateTo")}>
                <DatePicker id="cons-to" name="dateTo" value={dateTo} onChange={setDateTo} />
              </Field>
              <Button type="button" className="min-h-11" disabled={!selected} onClick={() => setPeriod({ dateFrom, dateTo })}>
                {t("platform.consolidation.run")}
              </Button>
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setEditing("new")}>
                <Plus className="h-4 w-4" aria-hidden="true" /> {t("platform.consolidation.newGroup")}
              </Button>
              {selected && (
                <>
                  <Button type="button" variant="outline" className="min-h-11" onClick={() => setEditing(selected)}>
                    <Pencil className="h-4 w-4" aria-hidden="true" /> {t("platform.consolidation.editGroup")}
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
              )}
            </div>
          </SectionCard>
        )}

        {report.isError && (
          <ErrorState
            description={report.error instanceof Error ? report.error.message : t("platform.consolidation.reportFailed")}
            onRetry={() => void report.refetch()}
          />
        )}
        {report.data && <ConsolidationReportView report={report.data} />}
      </div>

      {editing && (
        <ConsolidationGroupForm initial={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      )}
    </ModulePageShell>
  );
}
