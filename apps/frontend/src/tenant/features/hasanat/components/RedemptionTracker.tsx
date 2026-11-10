import React, { useState, useEffect } from "react";
import { Gift, Plus, Star } from "lucide-react";
import { type Redemption, type Distribution } from "@/lib/data/hasanatData";
import { useTranslation } from "@/hooks/useTranslation";
import { useListRowMotion } from "@/hooks/useListRowMotion";
import { formatDate, formatNumber, HASANAT_MODULE_MANIFEST } from "@mms/shared";
import {
  useHasanatRedemptionsState,
  useHasanatMutations,
} from "@/tenant/features/hasanat/hooks/useHasanatApi";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionHeader } from "@shared/ui";
import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import {
  DataTable,
  type DataTableColumn,
  type DataTableColumnLayout,
  type DataTableFilter,
} from "@/components/common/data-table";
import { RedeemModal } from "@/tenant/features/hasanat/components/RedeemModal";
import { RedemptionCard } from "./RedemptionCard";

/** Same storage key as `useHasanatRedemptionColumnLayout` so stand-alone use shares prefs. */
const REDEMPTION_TABLE_ID = `${HASANAT_MODULE_MANIFEST.moduleId}_redemptions`;

export interface RedemptionTrackerProps {
  distributions: Distribution[];
  onFilteredCountChange?: (count: number) => void;
  canWrite?: boolean;
  /** Controller-owned column layout (`useHasanatRedemptionColumnLayout`). */
  columnLayout?: DataTableColumnLayout;
  viewMode?: WorkDirectoryViewMode;
}

export function RedemptionTracker({
  distributions,
  onFilteredCountChange,
  canWrite = true,
  columnLayout,
  viewMode,
}: RedemptionTrackerProps): React.JSX.Element {
  const { t } = useTranslation();
  const rowMotion = useListRowMotion({ fade: true, duration: 0.1 });
  const { redemptions, isLoading, isError, refetch } = useHasanatRedemptionsState();
  const { redeemCard } = useHasanatMutations();
  const [showModal, setShowModal] = useState(false);
  const settled = !isLoading && !isError;

  useEffect(() => {
    // Only a settled ledger has a meaningful count; reporting 0 mid-flight flashed a wrong badge.
    if (settled) onFilteredCountChange?.(redemptions.length);
  }, [settled, redemptions.length, onFilteredCountChange]);

  // Net consumed value: a reversal row subtracts from the ledger.
  const totalPoints = redemptions.reduce(
    (sum: number, redemption: Redemption) =>
      sum + (redemption.kind === "reversal" ? -redemption.pointsUsed : redemption.pointsUsed),
    0,
  );

  const handleSave = async (redemption: Redemption & { clientRequestId?: string }) => {
    // One atomic request: the server locks the card, validates its value and writes the ledger
    // row + card status together. Never split this into "upsert list, then update the card".
    await redeemCard.mutateAsync(redemption.distributionId, {
      reward: redemption.reward,
      pointsUsed: redemption.pointsUsed,
      date: redemption.date,
      approvedByUserId: redemption.approvedByUserId ?? null,
      approvedBy: redemption.approvedBy ?? null,
      // Replay-safe: the server returns the original ledger row for a repeated key.
      ...(redemption.clientRequestId ? { clientRequestId: redemption.clientRequestId } : {}),
    });
    setShowModal(false);
  };

  const columns: DataTableColumn<Redemption>[] = [
    {
      id: "student",
      kind: "person",
      label: t("hasanat.columns.redemption.student"),
      fixed: true,
      noWrap: true,
      searchValue: (r) => r.studentName,
      render: (r) => (
        <span className="text-sm font-semibold text-foreground">{r.studentName || "—"}</span>
      ),
    },
    {
      id: "reward",
      kind: "shortText",
      label: t("hasanat.columns.redemption.reward"),
      render: (r) => r.reward,
    },
    {
      id: "pointsUsed",
      kind: "number",
      label: t("hasanat.columns.redemption.pointsUsed"),
      noWrap: true,
      render: (r) => (
        <span className="inline-flex items-center gap-1 text-sm font-bold text-warning">
          <Star className="w-3 h-3" aria-hidden="true" />
          {r.pointsUsed}
        </span>
      ),
    },
    {
      id: "date",
      kind: "date",
      label: t("hasanat.columns.redemption.date"),
      noWrap: true,
      searchValue: (r) => formatDate(r.date),
      render: (r) => <span className="text-muted-foreground">{formatDate(r.date)}</span>,
    },
    {
      id: "approvedBy",
      kind: "person",
      label: t("hasanat.columns.redemption.approvedBy"),
      render: (r) => <span className="text-muted-foreground">{r.approvedBy || "—"}</span>,
    },
  ];

  const rewardOptions = [...new Set(redemptions.map((r) => r.reward).filter(Boolean))].map(
    (reward) => ({
      value: reward,
      label: reward,
    }),
  );
  const filters: DataTableFilter<Redemption>[] = [
    {
      id: "reward",
      label: t("hasanat.columns.redemption.reward"),
      options: rewardOptions,
      getValue: (r) => r.reward,
    },
  ];

  return (
    <section aria-label={t("hasanat.tabs.redemptions")} className="space-y-4">
      <SectionHeader
        layout="row"
        icon={<Star className="w-4 h-4 text-warning" aria-hidden="true" />}
        iconClassName="bg-warning/10"
        title={
          settled
            ? t("hasanat.redemptionsSummary", {
                count: redemptions.length,
                points: formatNumber(totalPoints),
              })
            : isError
              ? t("hasanat.redemptionsLoadFailed")
              : t("common.loading")
        }
        actions={
          canWrite && (
            <Button
              type="button"
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 min-h-11 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" /> {t("hasanat.recordRedemption")}
            </Button>
          )
        }
      />

      {isLoading ? (
        <div className="space-y-3" aria-busy="true" aria-live="polite">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-center space-y-3"
        >
          <p className="text-sm font-semibold text-foreground">
            {t("hasanat.redemptionsLoadFailed")}
          </p>
          <p className="text-xs text-muted-foreground">{t("hasanat.loadFailedHint")}</p>
          <Button type="button" variant="outline" onClick={refetch} className="min-h-11">
            {t("common.retry")}
          </Button>
        </div>
      ) : (
        <DataTable
          tableId={REDEMPTION_TABLE_ID}
          label={t("hasanat.tabs.redemptions")}
          data={redemptions}
          columns={columns}
          filters={filters}
          columnLayout={columnLayout}
          defaultViewMode={viewMode}
          renderCard={(redemption, index, ctx) => (
            <RedemptionCard
              redemption={redemption}
              columnVisible={ctx.isColumnVisible}
              motionProps={rowMotion(index * 0.04)}
            />
          )}
          emptyState={
            <EmptyState variant="dashed" icon={Gift} title={t("hasanat.empty.redemptions")} />
          }
        />
      )}

      {canWrite && (
        <RedeemModal
          open={showModal}
          distributions={distributions}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        />
      )}
    </section>
  );
}
