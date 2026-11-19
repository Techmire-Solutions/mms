import React, { useMemo, useState } from "react";
import { CalendarClock } from "lucide-react";
import {
  ACCOUNTING_MODULE_MANIFEST,
  formatDate,
  type FiscalYear,
  type PostingPeriod,
} from "@mms/shared";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/app/FormSelect";
import { Field } from "@/components/app/FormPrimitives";
import { SectionCard } from "@/components/app/SectionCard";
import { Alert } from "@/components/app/Alert";
import { useTranslation } from "@/hooks/useTranslation";
import { usePermissions } from "@/tenant/hooks/usePermissions";
import {
  useClosePostingPeriod,
  usePostingPeriods,
  useReopenPostingPeriod,
} from "@/tenant/features/accounting/hooks/useAccountingLedgerOps";
import { AccountingPostingPeriodActionModal } from "./AccountingPostingPeriodActionModal";

interface PendingAction {
  period: PostingPeriod;
  action: "close" | "reopen";
}

/** Monthly posting-period lock controls; the server remains the enforcement point. */
export function AccountingPostingPeriodsSection({
  fiscalYears,
}: {
  fiscalYears: FiscalYear[];
}): React.JSX.Element {
  const { t } = useTranslation();
  const { can } = usePermissions();
  const canManage = can(ACCOUNTING_MODULE_MANIFEST.permissions.manage);
  const sortedFiscalYears = useMemo(
    () => [...fiscalYears].sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [fiscalYears],
  );
  const [fiscalYearId, setFiscalYearId] = useState(() => sortedFiscalYears[0]?.id ?? "");
  const fiscalYearKey = sortedFiscalYears.map((year) => year.id).join("|");
  const [prevFiscalYearKey, setPrevFiscalYearKey] = useState(fiscalYearKey);
  if (prevFiscalYearKey !== fiscalYearKey) {
    setPrevFiscalYearKey(fiscalYearKey);
    const stillSelectable = sortedFiscalYears.some((year) => year.id === fiscalYearId);
    setFiscalYearId(stillSelectable ? fiscalYearId : (sortedFiscalYears[0]?.id ?? ""));
  }
  const periodsQuery = usePostingPeriods(fiscalYearId || undefined);
  const closePeriod = useClosePostingPeriod();
  const reopenPeriod = useReopenPostingPeriod();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const saving = closePeriod.isPending || reopenPeriod.isPending;

  const periods = periodsQuery.data ?? [];
  const columns: DataTableColumn<PostingPeriod>[] = useMemo(
    () => [
      {
        id: "label",
        kind: "title",
        label: t("accounting.settings.postingPeriods.period"),
        fixed: true,
        render: (period) => period.label,
      },
      {
        id: "dates",
        kind: "date",
        label: t("accounting.settings.postingPeriods.dates"),
        render: (period) => `${formatDate(period.startDate)} – ${formatDate(period.endDate)}`,
      },
      {
        id: "status",
        kind: "status",
        label: t("common.status"),
        render: (period) => (
          <span
            className={
              period.status === "closed" ? "text-muted-foreground" : "font-medium text-success"
            }
          >
            {t(
              period.status === "closed"
                ? "accounting.settings.postingPeriods.statusClosed"
                : "accounting.settings.postingPeriods.statusOpen",
            )}
          </span>
        ),
      },
    ],
    [t],
  );

  const handleConfirm = async (reason?: string): Promise<void> => {
    if (!pending) return;
    const mutation = pending.action === "close" ? closePeriod : reopenPeriod;
    await mutation.mutateAsync({ id: pending.period.id, reason });
    setPending(null);
  };

  return (
    <SectionCard title={t("accounting.settings.postingPeriods.title")} icon={CalendarClock}>
      <p className="m-0 mb-3 text-xs text-muted-foreground text-pretty">
        {t("accounting.settings.postingPeriods.hint")}
      </p>
      {!canManage && (
        <Alert
          density="compact"
          tone="info"
          description={t("accounting.settings.postingPeriods.readOnly")}
        />
      )}
      <Field id="posting-periods-fy" label={t("accounting.settings.fy.label")}>
        <FormSelect
          id="posting-periods-fy"
          name="fiscalYearId"
          value={fiscalYearId}
          onChange={setFiscalYearId}
          options={sortedFiscalYears.map((year) => ({ value: year.id, label: year.label }))}
        />
      </Field>
      {periodsQuery.isError ? (
        <ErrorState
          compact
          description={t("accounting.settings.postingPeriods.loadFailed")}
          onRetry={() => void periodsQuery.refetch()}
        />
      ) : (
        <DataTable
          tableId="accounting.postingPeriods"
          label={t("accounting.settings.postingPeriods.title")}
          data={periods}
          columns={columns}
          isLoading={Boolean(fiscalYearId) && periodsQuery.isPending}
          card={{ title: (period) => period.label }}
          emptyState={<EmptyState title={t("accounting.settings.postingPeriods.empty")} />}
          renderRowActions={
            canManage
              ? (period) => (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-11"
                    disabled={saving || periodsQuery.isPending || periodsQuery.isError}
                    onClick={() =>
                      setPending({
                        period,
                        action: period.status === "closed" ? "reopen" : "close",
                      })
                    }
                  >
                    {t(
                      period.status === "closed"
                        ? "accounting.settings.postingPeriods.reopen"
                        : "accounting.settings.postingPeriods.close",
                    )}
                  </Button>
                )
              : undefined
          }
          actionsHeaderClassName="w-36 min-w-36"
          actionsCellClassName="w-36 min-w-36"
        />
      )}
      {pending ? (
        <AccountingPostingPeriodActionModal
          period={pending.period}
          action={pending.action}
          saving={saving}
          onClose={() => setPending(null)}
          onConfirm={handleConfirm}
        />
      ) : null}
    </SectionCard>
  );
}
