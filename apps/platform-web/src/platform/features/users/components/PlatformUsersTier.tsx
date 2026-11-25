import React, { Suspense } from "react";
import { CardSkeleton } from "@mms/ui";
import { PlatformUsersWorkTier } from "@/platform/features/users/components/PlatformUsersWorkTier";
import { PlatformUsersReportsTier } from "@/platform/features/users/components/PlatformUsersReportsTier";
import { PlatformUsersSetupTier } from "@/platform/features/users/components/PlatformUsersSetupTier";

export type PlatformUsersSubTab = "work" | "reports" | "setup";

/** Users module tier dispatcher (Work → Reports → Setup). Tab chrome lives in the module shell. */
export function PlatformUsersTier({
  activeTab,
}: {
  activeTab: PlatformUsersSubTab;
}): React.JSX.Element {
  return (
    <Suspense fallback={<CardSkeleton count={3} />}>
      {activeTab === "work" && <PlatformUsersWorkTier />}
      {activeTab === "reports" && <PlatformUsersReportsTier />}
      {activeTab === "setup" && <PlatformUsersSetupTier />}
    </Suspense>
  );
}
