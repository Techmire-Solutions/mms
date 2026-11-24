import React, { Suspense } from "react";
import { CardSkeleton } from "@mms/ui";
import { PlatformWorkspacesWorkTier } from "@/platform/features/workspaces/components/PlatformWorkspacesWorkTier";
import { PlatformWorkspacesReportsTier } from "@/platform/features/workspaces/components/PlatformWorkspacesReportsTier";
import { PlatformWorkspacesSetupTier } from "@/platform/features/workspaces/components/PlatformWorkspacesSetupTier";

export type PlatformWorkspacesTab = "work" | "reports" | "setup";

export interface PlatformWorkspacesTierProps {
  activeTab: PlatformWorkspacesTab;
}

/** Workspaces module tier dispatcher (Work → Reports → Setup). */
export function PlatformWorkspacesTier({
  activeTab,
}: PlatformWorkspacesTierProps): React.JSX.Element {
  return (
    <Suspense fallback={<CardSkeleton count={3} />}>
      {activeTab === "work" && <PlatformWorkspacesWorkTier />}
      {activeTab === "reports" && <PlatformWorkspacesReportsTier />}
      {activeTab === "setup" && <PlatformWorkspacesSetupTier />}
    </Suspense>
  );
}
