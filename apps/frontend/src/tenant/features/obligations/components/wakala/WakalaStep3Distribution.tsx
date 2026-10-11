import React from "react";
import {
  FormCardTypeSelect,
  FormCollectionShell,
  FormListFieldCard,
  TYPE_SELECT_WIDTH,
} from "@/components/ui/FormPrimitives";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/ui/FormSelect";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SEMANTIC_BADGE } from "@/lib/semanticTone";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import type { Mujtahid, MujtahidRep, ObligationType } from "@/lib/data/obligationsData";
import type { InitialDistRow } from "./wakalaFormModalTypes";

interface WakalaStep3DistributionProps {
  selectedObType: ObligationType | undefined;
  selectedRep: MujtahidRep | undefined;
  selectedMujtahid: Mujtahid | undefined;
  initialDistributions: InitialDistRow[];
  totalPercentage: number;
  onAddRow: () => void;
  onRemoveRow: (id: string) => void;
  onUpdateRow: (id: string, updates: Partial<InitialDistRow>) => void;
}

export function WakalaStep3Distribution({
  selectedObType,
  selectedRep,
  selectedMujtahid,
  initialDistributions,
  totalPercentage,
  onAddRow,
  onRemoveRow,
  onUpdateRow,
}: WakalaStep3DistributionProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 animate-in fade-in-50 duration-200">
      <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs space-y-1">
        <div className="font-semibold text-muted-foreground">
          {t("obligations.wakala.configSummary")}
        </div>
        <div className="flex flex-wrap gap-2 text-foreground font-medium">
          <span>{selectedObType?.name}</span>
          <span>•</span>
          <span>{selectedRep?.name}</span>
          <span>({selectedMujtahid?.name})</span>
        </div>
      </div>

      <FormCollectionShell
        title={
          <div className="flex w-full items-center justify-between gap-2">
            <h3 className="m-0 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t("obligations.wakala.initialSplit")}
            </h3>
            <StatusBadge
              status={
                totalPercentage === 100 ? "complete" : totalPercentage > 100 ? "over" : "under"
              }
              size="sm"
              config={{
                complete: {
                  label: t("obligations.wakala.total", { total: String(totalPercentage) }),
                  cls: SEMANTIC_BADGE.success,
                },
                over: {
                  label: t("obligations.wakala.total", { total: String(totalPercentage) }),
                  cls: SEMANTIC_BADGE.destructive,
                },
                under: {
                  label: t("obligations.wakala.total", { total: String(totalPercentage) }),
                  cls: SEMANTIC_BADGE.warning,
                },
              }}
            />
          </div>
        }
        addLabel={t("obligations.wakala.addDistribution")}
        onAdd={onAddRow}
        isEmpty={initialDistributions.length === 0}
        emptyMessage={t("obligations.wakala.noDistYet")}
        listKey="wakala-dist"
      >
        {initialDistributions.map((row, index) => (
          <FormListFieldCard
            key={row.id}
            id={`wakala-dist-${row.id}`}
            index={index}
            label={undefined}
            typeSelect={
              <FormCardTypeSelect label={t("obligations.wakala.distType")}>
                <FormSelect
                  id={`wakala-dist-type-${row.id}`}
                  name={`wakala-dist-type-${row.id}`}
                  aria-label={t("obligations.wakala.distType")}
                  value={row.type}
                  onChange={(val) => onUpdateRow(row.id, { type: val as "Income" | "Liability" })}
                  options={[
                    { value: "Income", label: t("obligations.distribution.income") },
                    { value: "Liability", label: t("obligations.distribution.liability") },
                  ]}
                  className={cn(TYPE_SELECT_WIDTH, "text-xs min-h-11")}
                />
              </FormCardTypeSelect>
            }
            removeLabel={t("common.delete")}
            canRemove
            onRemove={() => onRemoveRow(row.id)}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_6rem] items-start">
              <Input
                id={`wakala-dist-name-${row.id}`}
                name={`wakala-dist-name-${row.id}`}
                placeholder={t("obligations.wakala.namePlaceholder")}
                aria-label={t("obligations.wakala.distName")}
                value={row.name}
                onChange={(e) => onUpdateRow(row.id, { name: e.target.value })}
                className="text-xs min-h-11"
              />
              <Input
                id={`wakala-dist-pct-${row.id}`}
                name={`wakala-dist-pct-${row.id}`}
                type="text"
                inputMode="decimal"
                placeholder="%"
                aria-label={t("obligations.wakala.distPct")}
                value={
                  row.percentage === undefined || row.percentage === null
                    ? ""
                    : String(row.percentage)
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "" || /^\d*(\.\d{0,2})?$/.test(val)) {
                    const num = parseFloat(val) || 0;
                    if (num <= 100) {
                      onUpdateRow(row.id, {
                        percentage: val === "" ? ("" as unknown as number) : num,
                      });
                    }
                  }
                }}
                className="text-xs min-h-11"
              />
            </div>
          </FormListFieldCard>
        ))}
      </FormCollectionShell>
    </div>
  );
}
