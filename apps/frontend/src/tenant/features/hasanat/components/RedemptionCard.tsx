import React from "react";
import { Star } from "lucide-react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { formatDate } from "@mms/shared";
import type { Redemption } from "@/lib/data/hasanatData";
import { useTranslation } from "@/hooks/useTranslation";
import { DirectoryEntityCard } from "@/components/app/DirectoryEntityCard";
import { EntityCard } from "@/components/app/EntityCard";
import { DirectoryCardMetaTile } from "@/components/app/DirectoryCardMetaTile";

export interface RedemptionCardProps {
  redemption: Redemption;
  columnVisible: (key: string) => boolean;
  motionProps?: HTMLMotionProps<"div">;
}

/** Work directory card — DirectoryEntityCard SSOT (do not hand-compose EntityCard). */
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
    <DirectoryEntityCard
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
            <DirectoryCardMetaTile label={t("hasanat.columns.redemption.reward")}>
              <span className="break-words">{redemption.reward}</span>
            </DirectoryCardMetaTile>
          )}
          {columnVisible("date") && (
            <DirectoryCardMetaTile label={t("hasanat.columns.redemption.date")}>
              <span className="font-mono">{formatDate(redemption.date)}</span>
            </DirectoryCardMetaTile>
          )}
          {columnVisible("approvedBy") && (
            <DirectoryCardMetaTile label={t("hasanat.columns.redemption.approvedBy")}>
              <span className="break-words">{redemption.approvedBy || "—"}</span>
            </DirectoryCardMetaTile>
          )}
        </EntityCard.MetaGrid>
      }
      footer={false}
    />
  );

  if (!motionProps) return card;
  return <motion.div {...motionProps}>{card}</motion.div>;
}
