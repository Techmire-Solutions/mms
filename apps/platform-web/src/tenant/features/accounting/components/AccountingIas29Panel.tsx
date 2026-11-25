import type React from "react";
import { TrendingUp } from "lucide-react";
import { formatDate, type PriceIndexPoint } from "@mms/contracts";
import { DatePicker } from "@mms/fe-core/components/DatePicker";
import { EmptyState } from "@mms/ui";
import { Field } from "@mms/ui";
import { SectionCard } from "@mms/ui";
import { DataTable, type DataTableColumn } from "@mms/fe-core/components/data-table";
import { Button } from "@mms/ui";
import { Input } from "@mms/ui";
import { SETUP_SECTION_CARD_CLASS } from "@mms/ui";
import { useTranslation } from "@mms/fe-core/i18n";
import {
  useHyperinflationPanel,
  type HyperinflationPanel,
} from "@/tenant/features/accounting/hooks/useHyperinflationPanel";
import { AccountingIas29RunsPanel } from "./AccountingIas29RunsPanel";

type IndexRow = PriceIndexPoint & { id: string };

export interface AccountingIas29PanelProps {
  canEdit: boolean;
  panel?: HyperinflationPanel;
}

/** IAS 29 hyperinflation period-end work: general price index points and restatement runs. */
export function AccountingIas29Panel({
  canEdit,
  panel: propPanel,
}: AccountingIas29PanelProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const defaultPanel = useHyperinflationPanel();
  const panel = propPanel ?? defaultPanel;

  if (!panel.settings.enabled) {
    return null;
  }

  const indexColumns: DataTableColumn<IndexRow>[] = [
    {
      id: "date",
      kind: "date",
      label: t("accounting.settings.ias29.indexDate"),
      fixed: true,
      render: (row) => formatDate(row.indexDate),
    },
    {
      id: "value",
      kind: "number",
      label: t("accounting.settings.ias29.indexValue"),
      render: (row) => <span className="font-mono">{row.value}</span>,
    },
    {
      id: "source",
      kind: "shortText",
      label: t("accounting.settings.ias29.indexSource"),
      hideInCard: true,
      render: (row) => row.source,
    },
  ];

  return (
    <SectionCard
      title={t("accounting.settings.secIas29")}
      icon={TrendingUp}
      className={SETUP_SECTION_CARD_CLASS}
    >
      <div className="space-y-3">
        <h3 className="m-0 text-sm font-semibold text-balance">
          {t("accounting.settings.ias29.indexTitle")}
        </h3>
        {canEdit && (
          <div className="flex flex-wrap items-end gap-3">
            <Field id="ias29-index-date" label={t("accounting.settings.ias29.indexDate")}>
              <DatePicker
                id="ias29-index-date"
                name="indexDate"
                value={panel.indexDate}
                onChange={panel.setIndexDate}
              />
            </Field>
            <Field
              id="ias29-index-value"
              label={t("accounting.settings.ias29.indexValue")}
              error={panel.indexError ?? undefined}
            >
              <Input
                id="ias29-index-value"
                name="indexValue"
                inputMode="decimal"
                value={panel.indexValue}
                onChange={(event) => panel.setIndexValue(event.target.value)}
              />
            </Field>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => void panel.handleAddIndex()}
              disabled={!panel.indexValue.trim() || panel.savingIndex}
            >
              {t("accounting.settings.ias29.addIndex")}
            </Button>
          </div>
        )}
        <DataTable
          tableId="accounting.priceIndices"
          label={t("accounting.settings.ias29.indexTitle")}
          data={panel.indices.toReversed().map((point) => ({ ...point, id: point.indexDate }))}
          columns={indexColumns}
          isLoading={panel.indicesLoading}
          card={{ title: (row) => formatDate(row.indexDate) }}
          emptyState={<EmptyState title={t("accounting.settings.ias29.noIndices")} />}
        />
      </div>

      <AccountingIas29RunsPanel panel={panel} canEdit={canEdit} />
    </SectionCard>
  );
}
