import React from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { type WakalaType, type ObligationDistribution } from "@/lib/data/obligationsData";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge, type StatusBadgeConfigItem } from "@/components/ui/StatusBadge";
import { WarningCallout } from "@/components/ui/WarningCallout";
import { CARD_STRIPE_INSET, SEMANTIC_BADGE } from "@/lib/semanticTone";
import { cn } from "@/lib/utils";
import { WakalaDistributionList } from "@/tenant/features/obligations/components/WakalaDistributionList";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

interface WakalaTypeCardProps {
  wakalaType: WakalaType;
  typeName: string;
  repName: string;
  mujtahidName: string;
  wakalaDistributions: ObligationDistribution[];
  total: number;
  isComplete: boolean;
  distributionTypeConfig: Record<string, StatusBadgeConfigItem>;
  t: TranslationFunction;
  onEdit: () => void;
  onDelete: () => void;
  onEditDistribution: (distribution: ObligationDistribution) => void;
  onDeleteDistribution: (distributionId: string) => void;
  onAddDistribution: () => void;
}

export function WakalaTypeCard({
  wakalaType,
  typeName,
  repName,
  mujtahidName,
  wakalaDistributions,
  total,
  isComplete,
  distributionTypeConfig,
  t,
  onEdit,
  onDelete,
  onEditDistribution,
  onDeleteDistribution,
  onAddDistribution,
}: WakalaTypeCardProps): React.JSX.Element {
  return (
    <Card key={wakalaType.id} accentColor="primary" className="group/wakala">
      <header
        className={cn(
          "flex flex-col gap-2 border-b border-border/40 px-5 py-3 sm:flex-row sm:items-start sm:justify-between",
          CARD_STRIPE_INSET,
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="m-0 min-w-0 truncate text-sm font-bold text-foreground">{typeName}</h3>
            <span className="shrink-0 text-xs text-muted-foreground">
              {t("obligations.wakala.via")}
            </span>
            <span className="min-w-0 truncate text-sm font-semibold text-foreground">
              {repName}
            </span>
          </div>
          <p className="m-0 mt-0.5 truncate text-xs text-muted-foreground">
            {t("obligations.wakala.mujtahidLabel", { name: mujtahidName })}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 self-end sm:self-start">
          <span aria-label={t("obligations.wakala.totalPctAria", { pct: total.toFixed(0) })}>
            <StatusBadge
              status={isComplete ? "complete" : "incomplete"}
              size="sm"
              config={{
                complete: { label: `${total.toFixed(0)}%`, cls: SEMANTIC_BADGE.success },
                incomplete: { label: `${total.toFixed(0)}%`, cls: SEMANTIC_BADGE.warning },
              }}
            />
          </span>
          <Button
            type="button"
            aria-label={t("obligations.wakala.editAria", { name: typeName })}
            onClick={onEdit}
            variant="outline"
            size="icon"
            className="min-h-11 min-w-11 rounded-lg border-info/30 bg-info/5 text-info hover:text-info hover:bg-info/15 hover:border-info/40 shadow-none transition-colors"
          >
            <Pencil className="w-4 h-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            aria-label={t("obligations.wakala.deleteAria", { name: typeName })}
            onClick={onDelete}
            variant="outline"
            size="icon"
            className="min-h-11 min-w-11 rounded-lg border-destructive/30 bg-destructive/5 text-destructive hover:text-destructive hover:bg-destructive/15 hover:border-destructive/40 shadow-none transition-colors"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </Button>
        </div>
      </header>

      <div className="bg-muted/20">
        {!isComplete && total > 0 && (
          <WarningCallout
            density="compact"
            role="alert"
            className="rounded-none border-x-0 border-t-0"
            description={t("obligations.wakala.incompleteAlert", { pct: total.toFixed(1) })}
          />
        )}
        {wakalaDistributions.length === 0 ? (
          <EmptyState
            title={t("obligations.wakala.noDistributions")}
            compact
            icon={null}
            className="px-4 py-3"
          />
        ) : (
          <WakalaDistributionList
            distributions={wakalaDistributions}
            distributionTypeConfig={distributionTypeConfig}
            t={t}
            onEdit={onEditDistribution}
            onDelete={onDeleteDistribution}
          />
        )}
        {!isComplete && (
          <div className="px-4 py-2 border-t border-border">
            <Button
              type="button"
              onClick={onAddDistribution}
              variant="ghost"
              className="flex items-center gap-1 min-h-11 h-auto px-1 text-xs font-semibold text-primary hover:text-primary/80 hover:bg-transparent shadow-none transition-colors"
            >
              <Plus className="w-3 h-3" aria-hidden="true" />{" "}
              {t("obligations.wakala.addDistribution")}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
