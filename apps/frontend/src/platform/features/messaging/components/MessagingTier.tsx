import React, { Suspense } from "react";
import { CardSkeleton } from "@shared/ui";
import { MessagingWorkTier } from "@/platform/features/messaging/components/MessagingWorkTier";
import { MessagingReportsTier } from "@/platform/features/messaging/components/MessagingReportsTier";
import { MessagingSetupTier } from "@/platform/features/messaging/components/MessagingSetupTier";

export type PlatformMessagingTab = "work" | "reports" | "setup";

/** Messaging module tier dispatcher (Work → Reports → Setup). */
export function MessagingTier({
  activeTab,
}: {
  activeTab: PlatformMessagingTab;
}): React.JSX.Element {
  return (
    <Suspense fallback={<CardSkeleton count={3} />}>
      {activeTab === "work" && <MessagingWorkTier />}
      {activeTab === "reports" && <MessagingReportsTier />}
      {activeTab === "setup" && <MessagingSetupTier />}
    </Suspense>
  );
}
