import type React from "react";
import { ShieldCheck } from "lucide-react";
import {
  formatDate,
  formatMoney,
  tryParseMoneyAmountNumber,
  type Account,
  type AppTranslationKey,
  type HedgeRelationship,
  type HedgeStatus,
} from "@mms/contracts";
import { DatePicker } from "@mms/fe-core/components/DatePicker";
import { EmptyState } from "@mms/ui";
import { ErrorState } from "@mms/fe-core/components/ErrorState";
import { Field } from "@mms/ui";
import { SectionCard } from "@mms/ui";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { Button } from "@mms/ui";
import { SETUP_SECTION_CARD_CLASS } from "@mms/ui";
import { useTranslation } from "@mms/fe-core/i18n";
import { useAccountingCurrencySettings } from "@/tenant/features/accounting/hooks/useAccountingFx";
import { useHedgesPanel } from "@/tenant/features/accounting/hooks/useHedgesPanel";
import { HedgeActionModal } from "@mms/mod-accounting/frontend/tenant";
import { HedgeDesignationModal } from "@mms/mod-accounting/frontend/tenant";

const STATUS_KEYS: Record<HedgeStatus, AppTranslationKey> = {
  active: "accounting.settings.hedges.statusActive",
  settled: "accounting.settings.hedges.statusSettled",
  reclassified: "accounting.settings.hedges.statusReclassified",
  discontinued: "accounting.settings.hedges.statusDiscontinued",
};

export interface AccountingHedgesSectionProps {
  accounts: Account[];
  canEdit: boolean;
}

/** IFRS 9 FX forward hedges: designate, value at closing rates, settle and reclassify the reserve. */
export function AccountingHedgesSection({
  accounts,
  canEdit,
}: AccountingHedgesSectionProps): React.JSX.Element {
  const { t } = useTranslation();
  const panel = useHedgesPanel();
  const currencies = useAccountingCurrencySettings().data?.enabledCurrencies ?? [];
  const latest = (hedge: HedgeRelationship) =>
    hedge.valuations.findLast((record) => record.kind !== "reclassification");

  const columns: DataTableColumn<HedgeRelationship>[] = [
    {
      id: "name",
      kind: "title",
      label: t("accounting.settings.hedges.name"),
      fixed: true,
      render: (hedge) => hedge.name,
    },
    {
      id: "type",
      kind: "status",
      label: t("accounting.settings.hedges.type"),
      render: (hedge) =>
        t(
          hedge.hedgeType === "cash_flow"
            ? "accounting.settings.hedges.cashFlow"
            : "accounting.settings.hedges.fairValue",
        ),
    },
    {
      id: "terms",
      kind: "longText",
      label: t("accounting.settings.hedges.notional"),
      render: (hedge) => (
        <span className="font-mono">
          {t(
            hedge.direction === "buy"
              ? "accounting.settings.hedges.buy"
              : "accounting.settings.hedges.sell",
          )}{" "}
          {formatMoney(Number(hedge.notional), hedge.currency, { useSymbol: true })} @{" "}
          {hedge.contractRate}
        </span>
      ),
    },
    {
      id: "maturity",
      kind: "date",
      label: t("accounting.settings.hedges.maturityDate"),
      hideInCard: true,
      render: (hedge) => formatDate(hedge.maturityDate),
    },
    {
      id: "value",
      kind: "money",
      label: t("accounting.settings.hedges.fairValueColumn"),
      render: (hedge) => (
        <span className="font-mono">
          {formatMoney(tryParseMoneyAmountNumber(latest(hedge)?.instrumentValue) ?? 0, undefined, {
            useSymbol: true,
          })}
        </span>
      ),
    },
    {
      id: "status",
      kind: "status",
      label: t("accounting.settings.hedges.status"),
      render: (hedge) => t(STATUS_KEYS[hedge.status]),
    },
  ];

  return (
    <SectionCard
      title={t("accounting.settings.secHedges")}
      icon={ShieldCheck}
      className={SETUP_SECTION_CARD_CLASS}
    >
      <p className="m-0 mb-3 text-xs text-muted-foreground text-pretty">
        {t("accounting.settings.hedges.hint")}
      </p>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <Field id="hedge-valuation-date" label={t("accounting.settings.hedges.valuationDate")}>
          <DatePicker
            id="hedge-valuation-date"
            name="valuationDate"
            value={panel.valuationDate}
            onChange={panel.setValuationDate}
          />
        </Field>
        {canEdit && (
          <Button
            type="button"
            className="min-h-11"
            onClick={() => panel.setDesignating(true)}
            disabled={currencies.length === 0}
          >
            {t("accounting.settings.hedges.designate")}
          </Button>
        )}
      </div>
      {panel.loadError ? (
        <ErrorState
          compact
          description={t("accounting.settings.hedges.loadFailed")}
          onRetry={() => void panel.refetch()}
        />
      ) : (
        <DataTable
          tableId="accounting.hedges"
          label={t("accounting.settings.secHedges")}
          data={panel.hedges}
          columns={columns}
          isLoading={panel.loading}
          card={{ title: (hedge) => hedge.name }}
          emptyState={<EmptyState title={t("accounting.settings.hedges.empty")} />}
          renderRowActions={
            canEdit
              ? (hedge) => (
                  <div className="flex flex-wrap gap-2">
                    {hedge.status === "active" && (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="min-h-11"
                          disabled={panel.valuing}
                          onClick={() => void panel.handleValue(hedge)}
                        >
                          {t("accounting.settings.hedges.value")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="min-h-11"
                          onClick={() => panel.setPending({ action: "settle", hedge })}
                        >
                          {t("accounting.settings.hedges.settle")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="min-h-11"
                          onClick={() => panel.setPending({ action: "discontinue", hedge })}
                        >
                          {t("accounting.settings.hedges.discontinue")}
                        </Button>
                      </>
                    )}
                    {(hedge.status === "settled" || hedge.status === "discontinued") &&
                      hedge.hedgeType === "cash_flow" && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="min-h-11"
                          onClick={() => panel.setPending({ action: "reclassify", hedge })}
                        >
                          {t("accounting.settings.hedges.reclassify")}
                        </Button>
                      )}
                  </div>
                )
              : undefined
          }
          actionsHeaderClassName="w-64 min-w-64"
          actionsCellClassName="w-64 min-w-64"
        />
      )}
      {panel.designating && (
        <HedgeDesignationModal
          open
          accounts={accounts}
          currencies={currencies}
          onClose={() => panel.setDesignating(false)}
          onSave={panel.handleCreate}
        />
      )}
      {panel.pending && (
        <HedgeActionModal
          action={panel.pending.action}
          hedge={panel.pending.hedge}
          accounts={accounts}
          saving={panel.acting}
          onClose={() => panel.setPending(null)}
          onSave={panel.handleAction}
        />
      )}
    </SectionCard>
  );
}
