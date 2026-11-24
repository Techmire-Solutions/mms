import React, { Suspense } from "react";
import { CardSkeleton } from "@shared/ui";
import { PlatformConsolidationWorkTier } from "@/platform/features/consolidation/components/PlatformConsolidationWorkTier";
import { PlatformConsolidationReportsTier } from "@/platform/features/consolidation/components/PlatformConsolidationReportsTier";
import { PlatformConsolidationSetupTier } from "@/platform/features/consolidation/components/PlatformConsolidationSetupTier";

export type PlatformConsolidationTab = "work" | "reports" | "setup";

/** Consolidation module tier dispatcher (Work → Reports → Setup). */
export function PlatformConsolidationTier({
  activeTab,
}: {
  activeTab: PlatformConsolidationTab;
}): React.JSX.Element {
  return (
    <Suspense fallback={<CardSkeleton count={2} />}>
      {activeTab === "work" && <PlatformConsolidationWorkTier />}
      {activeTab === "reports" && <PlatformConsolidationReportsTier />}
      {activeTab === "setup" && <PlatformConsolidationSetupTier />}
    </Suspense>
  );
}
