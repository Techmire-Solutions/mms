import React from "react";
import { User, Users2 } from "lucide-react";
import { StatusBadge } from "@/components/app/StatusBadge";
import type { WorkBatchTableColumn } from "@/components/common/work";
import type { Distribution } from "@/lib/data/hasanatData";
import {
  getDistributionDenomination,
  type DistributionsListContentProps,
} from "@/tenant/features/hasanat/lib/distributionsListShared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface UseDistributionsTableColumnsOptions {
  denoms: DistributionsListContentProps["denoms"];
  isColumnVisible: (key: string) => boolean;
  statusConfig: DistributionsListContentProps["statusConfig"];
  t: TranslationFunction;
}

export function useDistributionsTableColumns({
  denoms,
  isColumnVisible,
  statusConfig,
  t,
}: UseDistributionsTableColumnsOptions): WorkBatchTableColumn<Distribution>[] {
  const denomsById = React.useMemo(() => {
    const map = new Map<string, (typeof denoms)[number]>();
    for (const d of denoms) {
      map.set(d.id, d);
    }
    return map;
  }, [denoms]);

  return React.useMemo<WorkBatchTableColumn<Distribution>[]>(() => {
    const cols: WorkBatchTableColumn<Distribution>[] = [];

    if (isColumnVisible("card")) {
      cols.push({
        id: "card",
        label: t("hasanat.columns.distribution.card"),
        noWrap: true,
        render: (distribution) => {
          const denomination = getDistributionDenomination(denomsById, distribution.denominationId);
          return (
            <div className="flex items-center gap-2">
              <span className="text-base" aria-hidden="true">
                {denomination?.icon || "⭐"}
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground m-0">
                  {distribution.denominationName}
                </p>
                {denomination && (
                  <p className="text-xs font-bold m-0" style={{ color: denomination.color }}>
                    {t("hasanat.form.pointsShort", { points: denomination.points })}
                  </p>
                )}
              </div>
            </div>
          );
        },
      });
    }

    if (isColumnVisible("recipient")) {
      cols.push({
        id: "recipient",
        label: t("hasanat.columns.distribution.recipient"),
        noWrap: true,
        render: (distribution) => (
          <span className="text-sm font-semibold text-foreground">
            {distribution.recipientName}
          </span>
        ),
      });
    }

    if (isColumnVisible("recipientType")) {
      cols.push({
        id: "recipientType",
        label: t("hasanat.columns.distribution.recipientType"),
        noWrap: true,
        render: (distribution) => (
          <div className="flex items-center gap-1.5">
            {distribution.recipientType === "faculty" ? (
              <Users2 className="w-3 h-3 text-muted-foreground" aria-hidden="true" />
            ) : (
              <User className="w-3 h-3 text-muted-foreground" aria-hidden="true" />
            )}
            <span className="text-sm text-muted-foreground">
              {distribution.recipientType === "faculty"
                ? t("hasanat.form.recipientType.faculty")
                : t("hasanat.form.recipientType.student")}
            </span>
          </div>
        ),
      });
    }

    if (isColumnVisible("recipientClass")) {
      cols.push({
        id: "recipientClass",
        label: t("hasanat.columns.distribution.recipientClass"),
        cellClassName: "text-sm text-muted-foreground",
        render: (distribution) => distribution.recipientClass || "—",
      });
    }

    if (isColumnVisible("quantity")) {
      cols.push({
        id: "quantity",
        label: t("hasanat.columns.distribution.quantity"),
        noWrap: true,
        render: (distribution) => (
          <span className="text-sm font-bold text-foreground">{distribution.quantity}</span>
        ),
      });
    }

    if (isColumnVisible("reason")) {
      cols.push({
        id: "reason",
        label: t("hasanat.columns.distribution.reason"),
        truncate: true,
        cellClassName: "max-w-cell-sm",
        render: (distribution) => (
          <p className="text-sm text-muted-foreground m-0">{distribution.reason}</p>
        ),
      });
    }

    if (isColumnVisible("issuedDate")) {
      cols.push({
        id: "issuedDate",
        label: t("hasanat.columns.distribution.issuedDate"),
        noWrap: true,
        cellClassName: "text-xs text-muted-foreground",
        render: (distribution) => distribution.issuedDate,
      });
    }

    if (isColumnVisible("issuedBy")) {
      cols.push({
        id: "issuedBy",
        label: t("hasanat.columns.distribution.issuedBy"),
        noWrap: true,
        cellClassName: "text-sm text-muted-foreground",
        render: (distribution) => distribution.issuedBy || "—",
      });
    }

    if (isColumnVisible("status")) {
      cols.push({
        id: "status",
        label: t("hasanat.columns.distribution.status"),
        render: (distribution) => (
          <StatusBadge status={distribution.status} config={statusConfig} size="sm" />
        ),
      });
    }

    return cols;
  }, [denomsById, isColumnVisible, statusConfig, t]);
}
