import React from "react";
import { Star } from "lucide-react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { formatDate } from "@mms/shared";
import type { Redemption } from "@/lib/data/hasanatData";
import { useTranslation } from "@/hooks/useTranslation";
import { DirectoryCard } from "@/components/app/DirectoryCard";
import { EntityCard } from "@/components/app/EntityCard";
import { EntityCardMetaTile } from "@/components/app/EntityCardMetaTile";

export interface RedemptionCardProps {
  redemption: Redemption;
  columnVisible: (key: string) => boolean;
  motionProps?: HTMLMotionProps<"div">;
}

/** Work directory card — DirectoryCard SSOT (do not hand-compose EntityCard). */
export function RedemptionCard({
  redemption,
  columnVisible,
  motionProps,
}: RedemptionCardProps): React.JSX.Element {
  const { t } = useTranslation();

  const subtitle = columnVisible("pointsUsed") ? (
    <div className="flex shrink-0 items-center gap-1 mt-0.5">
      <Star className="w-3.5 h-3.5 text-warning" aria-hidden="true" />
      <span className="text-xs font-bold text-warning">
        {t("hasanat.form.pointsShort", { points: redemption.pointsUsed })}
      </span>
    </div>
  ) : undefined;

  const card = (
    <DirectoryCard
      entity={redemption}
      canSelect={false}
      className="space-y-3 p-4"
      header={{
        displayName: redemption.studentName || "—",
        subtitle,
        showSelect: false,
      }}
      metadataSlot={
        <EntityCard.MetaGrid className="pt-2 border-t border-border/40 ms-0">
          {columnVisible("reward") && (
            <EntityCardMetaTile label={t("hasanat.columns.redemption.reward")}>
              <span className="break-words">{redemption.reward}</span>
            </EntityCardMetaTile>
          )}
          {columnVisible("date") && (
            <EntityCardMetaTile label={t("hasanat.columns.redemption.date")}>
              <span className="font-mono">{formatDate(redemption.date)}</span>
            </EntityCardMetaTile>
          )}
          {columnVisible("approvedBy") && (
            <EntityCardMetaTile label={t("hasanat.columns.redemption.approvedBy")}>
              <span className="break-words">{redemption.approvedBy || "—"}</span>
            </EntityCardMetaTile>
          )}
        </EntityCard.MetaGrid>
      }
      footer={false}
    />
  );

  if (!motionProps) return card;
  return <motion.div {...motionProps}>{card}</motion.div>;
}
