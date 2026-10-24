import React, { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Package } from "lucide-react";
import { type Denomination, type StockBatch } from "@/lib/data/hasanatData";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/app/EmptyState";
import { ProgressBar } from "@/components/app/ProgressBar";
import { SectionHeader } from "@shared/ui";
import { useTranslation } from "@/hooks/useTranslation";
import { StockAddBatchModal } from "@/tenant/features/hasanat/components/StockAddBatchModal";
import { CARD_STRIPE_BASE, CARD_STRIPE_INSET } from "@/lib/ui/semanticTone";
import { cn } from "@/lib/utils";

export interface StockManagerProps {
  batches: StockBatch[];
  denoms: Denomination[];
  onUpdate: (batches: StockBatch[]) => void | Promise<void>;
  onUpdateDenoms?: (denoms: Denomination[]) => void | Promise<void>;
  canWrite?: boolean;
}

export function StockManager({
  batches,
  denoms,
  onUpdate,
  onUpdateDenoms,
  canWrite = true,
}: StockManagerProps): React.JSX.Element {
  const { t } = useTranslation();
  const [showModal, setShowModal] = useState(false);

  const handleAdd = async (batch: StockBatch) => {
    await onUpdate([...batches, batch]);
    setShowModal(false);
  };

  const grouped = denoms.reduce(
    (
      groups: Record<string, { den: Denomination; batches: StockBatch[] }>,
      denomination: Denomination,
    ) => {
      const denominationBatches = batches.filter(
        (batch: StockBatch) => batch.denominationId === denomination.id,
      );
      if (denominationBatches.length > 0)
        groups[denomination.id] = { den: denomination, batches: denominationBatches };
      return groups;
    },
    {} as Record<string, { den: Denomination; batches: StockBatch[] }>,
  );

  return (
    <section aria-label={t("hasanat.tabs.stock")} className="space-y-5">
      <SectionHeader
        noMargin
        title={t("hasanat.stock.batchCount", { count: batches.length })}
        actions={
          canWrite && (
            <Button
              type="button"
              onClick={() => setShowModal(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />{" "}
              {t("hasanat.stock.addBatchAction")}
            </Button>
          )
        }
      />

      {(Object.values(grouped) as { den: Denomination; batches: StockBatch[] }[]).map(
        ({ den, batches: denominationBatches }) => {
          const totalStock = denominationBatches.reduce(
            (sum: number, batch: StockBatch) => sum + batch.quantity,
            0,
          );
          const totalRemaining = denominationBatches.reduce(
            (sum: number, batch: StockBatch) => sum + batch.remaining,
            0,
          );
          const pct = totalStock > 0 ? Math.round((totalRemaining / totalStock) * 100) : 0;

          return (
            <Card key={den.id} className={CARD_STRIPE_INSET}>
              <div
                aria-hidden="true"
                className={cn(CARD_STRIPE_BASE, "transition-colors duration-300")}
                style={{ backgroundColor: den.color }}
              />
              <header className="flex items-center gap-3 border-b border-border/40 bg-muted/20 px-4 py-3 ps-4">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg"
                  style={{ background: den.color }}
                  aria-hidden="true"
                >
                  {den.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-bold text-foreground m-0">{den.name}</h3>
                  <p className="truncate text-xs text-muted-foreground m-0">
                    {t("hasanat.stock.pointsAvailable", {
                      points: den.points,
                      remaining: totalRemaining,
                      total: totalStock,
                    })}
                  </p>
                </div>
                <div className="w-20 shrink-0">
                  <ProgressBar
                    value={pct}
                    fillStyle={{ background: den.color }}
                    trackClassName="bg-border"
                    aria-label={`${den.name} availability`}
                  />
                  <p className="text-xs text-end text-muted-foreground mt-0.5 m-0">{pct}%</p>
                </div>
              </header>

              <div className="divide-y divide-border/50">
                {denominationBatches.map((batch: StockBatch, index: number) => {
                  const batchPercentage =
                    batch.quantity > 0 ? Math.round((batch.remaining / batch.quantity) * 100) : 0;
                  return (
                    <motion.div
                      key={batch.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.04 }}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <Package
                        className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0"
                        aria-hidden="true"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground m-0">
                          {batch.note || t("hasanat.stock.batchFallback")}
                        </p>
                        <p className="text-xs text-muted-foreground m-0">
                          {t("hasanat.stock.addedMeta", {
                            date: batch.addedDate,
                            by: batch.addedBy || "—",
                          })}
                        </p>
                      </div>
                      <div className="text-end flex-shrink-0">
                        <p className="text-sm font-bold text-foreground m-0">
                          {batch.remaining}
                          <span className="text-muted-foreground font-normal">
                            /{batch.quantity}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground m-0">
                          {t("hasanat.stock.pctLeft", { pct: batchPercentage })}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </Card>
          );
        },
      )}

      {batches.length === 0 && (
        <EmptyState variant="dashed" icon={Package} title={t("hasanat.stock.empty")} />
      )}

      {canWrite && (
        <StockAddBatchModal
          open={showModal}
          denoms={denoms}
          onClose={() => setShowModal(false)}
          onSave={handleAdd}
          onDenomsChange={onUpdateDenoms}
        />
      )}
    </section>
  );
}
