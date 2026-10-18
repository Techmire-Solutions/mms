import React, { Suspense } from "react";
import { Users, BarChart3, Settings } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { SubTabBar, type SubTab } from "@/components/app/SubTabBar";
import { CardSkeleton } from "@shared/ui";
import { PlatformUsersWorkTier } from "@/platform/components/users/PlatformUsersWorkTier";
import { PlatformUsersReportsTier } from "@/platform/components/users/PlatformUsersReportsTier";
import { PlatformUsersSetupTier } from "@/platform/components/users/PlatformUsersSetupTier";

export type PlatformUsersSubTab = "work" | "reports" | "setup";

export interface PlatformUsersTierProps {
  activeSubTab?: PlatformUsersSubTab;
  onSubTabChange?: (tab: PlatformUsersSubTab) => void;
  showSubTabBar?: boolean;
}

function UsersFallback(): React.JSX.Element {
  return <CardSkeleton count={3} />;
}

/**
 * Platform Users Tier component.
 * 1. Work — Operators directory
 * 2. Reports — Operator capabilities and role metrics
 * 3. Setup — Permissions matrix
 */
export function PlatformUsersTier({
  activeSubTab = "work",
  onSubTabChange,
  showSubTabBar = true,
}: PlatformUsersTierProps): React.JSX.Element {
  const { t } = useTranslation();

  const subTabs: readonly SubTab<PlatformUsersSubTab>[] = [
    {
      key: "work",
      label: t("module.work"),
      icon: Users,
    },
    {
      key: "reports",
      label: t("module.reports"),
      icon: BarChart3,
    },
    {
      key: "setup",
      label: t("module.setup"),
      icon: Settings,
    },
  ];

  return (
    <div className="space-y-6 text-start">
      {showSubTabBar && onSubTabChange ? (
        <SubTabBar
          tabs={subTabs}
          value={activeSubTab}
          onChange={onSubTabChange}
          variant="pill"
          panelIdPrefix="platform-users-tier-subtab"
        />
      ) : null}

      <Suspense fallback={<UsersFallback />}>
        {activeSubTab === "work" && <PlatformUsersWorkTier />}
        {activeSubTab === "reports" && <PlatformUsersReportsTier />}
        {activeSubTab === "setup" && <PlatformUsersSetupTier />}
      </Suspense>
    </div>
  );
}
