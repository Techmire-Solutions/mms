import React, { useState, useEffect } from "react";
import { Gift, Plus, Star } from "lucide-react";
import { type Redemption, type Distribution } from "@/lib/data/hasanatData";
import { useTranslation } from "@/hooks/useTranslation";
import { useListRowMotion } from "@/hooks/useListRowMotion";
import { formatDate, formatNumber, HASANAT_MODULE_MANIFEST } from "@mms/shared";
import {
  useHasanatRedemptionsCollection,
  useHasanatMutations,
} from "@/tenant/features/hasanat/hooks/useHasanatApi";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/EmptyState";
import { SectionHeader } from "@/components/app/SectionHeader";
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
  onUpdateDistribution: (distribution: Distribution) => void | Promise<void>;
  onFilteredCountChange?: (count: number) => void;
  canWrite?: boolean;
  /** Controller-owned column layout (`useHasanatRedemptionColumnLayout`). */
  columnLayout?: DataTableColumnLayout;
  viewMode?: WorkDirectoryViewMode;
}

export function RedemptionTracker({
  distributions,
  onUpdateDistribution,
  onFilteredCountChange,
  canWrite = true,
  columnLayout,
  viewMode,
}: RedemptionTrackerProps): React.JSX.Element {
  const { t } = useTranslation();
  const rowMotion = useListRowMotion({ fade: true, duration: 0.1 });
  const redemptions = useHasanatRedemptionsCollection();
  const { replaceRedemptions } = useHasanatMutations();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    onFilteredCountChange?.(redemptions.length);
  }, [redemptions.length, onFilteredCountChange]);

  const totalPoints = redemptions.reduce(
    (sum: number, redemption: Redemption) => sum + redemption.pointsUsed,
    0,
  );

  const handleSave = async (redemption: Redemption) => {
    await replaceRedemptions.mutateAsync([...redemptions, redemption]);
    const distribution = distributions.find((item) => item.id === redemption.distributionId);
    if (distribution) {
      await onUpdateDistribution({ ...distribution, status: "redeemed" as const });
    }
    setShowModal(false);
  };

  const columns: DataTableColumn<Redemption>[] = [
    {
      id: "student",
      label: t("hasanat.columns.redemption.student"),
      fixed: true,
      noWrap: true,
      searchValue: (r) => r.studentName,
      render: (r) => (
        <span className="text-sm font-semibold text-foreground">{r.studentName || "—"}</span>
      ),
    },
    { id: "reward", label: t("hasanat.columns.redemption.reward"), render: (r) => r.reward },
    {
      id: "pointsUsed",
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
      label: t("hasanat.columns.redemption.date"),
      noWrap: true,
      searchValue: (r) => formatDate(r.date),
      render: (r) => <span className="text-muted-foreground">{formatDate(r.date)}</span>,
    },
    {
      id: "approvedBy",
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
        title={t("hasanat.redemptionsSummary", {
          count: redemptions.length,
          points: formatNumber(totalPoints),
        })}
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
