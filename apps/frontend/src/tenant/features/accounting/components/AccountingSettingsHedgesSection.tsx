import type React from "react";
import { ShieldCheck } from "lucide-react";
import {
  formatDate,
  formatMoney,
  type Account,
  type AppTranslationKey,
  type HedgeRelationship,
  type HedgeStatus,
} from "@mms/shared";
import { DatePicker } from "@/components/app/DatePicker";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { Field } from "@/components/app/FormPrimitives";
import { SectionCard } from "@/components/app/SectionCard";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { Button } from "@/components/ui/button";
import { SETUP_SECTION_CARD_CLASS } from "@/components/ui/formStyles";
import { useTranslation } from "@/hooks/useTranslation";
import { useAccountingCurrencySettings } from "@/tenant/features/accounting/hooks/useAccountingFx";
import { useHedgesPanel } from "@/tenant/features/accounting/hooks/useHedgesPanel";
import { HedgeActionModal } from "./HedgeActionModal";
import { HedgeDesignationModal } from "./HedgeDesignationModal";

const STATUS_KEYS: Record<HedgeStatus, AppTranslationKey> = {
  active: "accounting.settings.hedges.statusActive",
  settled: "accounting.settings.hedges.statusSettled",
  reclassified: "accounting.settings.hedges.statusReclassified",
  discontinued: "accounting.settings.hedges.statusDiscontinued",
};

interface AccountingSettingsHedgesSectionProps {
  accounts: Account[];
  canEditSetup: boolean;
}

/** IFRS 9 FX forward hedges: designate, value at closing rates, settle and reclassify the reserve. */
export function AccountingSettingsHedgesSection({
  accounts,
  canEditSetup,
}: AccountingSettingsHedgesSectionProps): React.JSX.Element {
  const { t } = useTranslation();
  const panel = useHedgesPanel();
  const currencies = useAccountingCurrencySettings().data?.enabledCurrencies ?? [];
  const latest = (hedge: HedgeRelationship) =>
    hedge.valuations.findLast((record) => record.kind !== "reclassification");

  const columns: DataTableColumn<HedgeRelationship>[] = [
    {
      id: "name",
      label: t("accounting.settings.hedges.name"),
      fixed: true,
      render: (hedge) => hedge.name,
    },
    {
      id: "type",
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
      label: t("accounting.settings.hedges.maturityDate"),
      hideInCard: true,
      render: (hedge) => formatDate(hedge.maturityDate),
    },
    {
      id: "value",
      label: t("accounting.settings.hedges.fairValueColumn"),
      render: (hedge) => (
        <span className="font-mono">
          {formatMoney(Number(latest(hedge)?.instrumentValue ?? 0), undefined, { useSymbol: true })}
        </span>
      ),
    },
    {
      id: "status",
      label: t("accounting.settings.hedges.status"),
      render: (hedge) => t(STATUS_KEYS[hedge.status]),
    },
    {
      id: "actions",
      label: t("accounting.settings.hedges.actions"),
      render: (hedge) =>
        canEditSetup ? (
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
              </>
            )}
            {hedge.status === "settled" && hedge.hedgeType === "cash_flow" && (
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
        ) : null,
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
        {canEditSetup && (
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
