import React from "react";
import { Menu } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import { usePlatformPermissions } from "@/platform/hooks/usePlatformPermissions";
import { usePlatformSidebar } from "@/platform/lib/PlatformSidebarContext";
import { usePlatformHealth } from "@/platform/hooks/usePlatformHealth";
import { usePlatformBreadcrumb } from "@/platform/lib/PlatformBreadcrumbContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { ROUTES, isNavPathActive } from "@/lib/config/routes";
import { PLATFORM_NAV_ITEMS } from "@/platform/lib/platformNav";
import { PlatformHeaderBrand } from "@/platform/components/header/PlatformHeaderBrand";
import { PlatformHeaderUserNav } from "@/platform/components/header/PlatformHeaderUserNav";
import { PlatformWorkspaceSwitcher } from "@/platform/components/header/PlatformWorkspaceSwitcher";

export interface PlatformPageShellHeaderProps {
  onOpenSearch?: () => void;
  searchOpen?: boolean;
  onOpenAi?: () => void;
  aiOpen?: boolean;
}

type HealthStatus = "operational" | "degraded" | "unknown";

export function PlatformPageShellHeader({
  onOpenSearch,
  searchOpen = false,
  onOpenAi,
  aiOpen = false,
}: PlatformPageShellHeaderProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const location = useLocation();
  const perms = usePlatformPermissions();
  const { isPlatformAuthenticated } = perms;
  const { openMobileSidebar } = usePlatformSidebar();
  const { status: rawStatus } = usePlatformHealth();
  const { extraSegments } = usePlatformBreadcrumb();
  const status = (rawStatus as HealthStatus | undefined) ?? "unknown";

  if (!isPlatformAuthenticated) return null;

  const activeNavItem = PLATFORM_NAV_ITEMS.find((item) =>
    isNavPathActive(location.pathname, item.path),
  );

  const healthLabel =
    status === "operational"
      ? t("platform.statusOperational")
      : status === "degraded"
        ? t("platform.statusDegraded")
        : t("platform.statusUnknown");

  const navSegment =
    activeNavItem && activeNavItem.path !== ROUTES.platformDashboard
      ? [
          {
            label: t(activeNavItem.labelKey),
            href: extraSegments.length > 0 ? activeNavItem.path : undefined,
          },
        ]
      : [];

  const breadcrumbItems = [
    { label: t("platform.consoleTitle"), href: ROUTES.platformDashboard },
    ...navSegment,
    ...extraSegments,
  ];

  return (
    <div className="sticky top-0 z-header w-full border-b border-border bg-card/80 backdrop-blur-xl transition-all duration-300">
      <div className="w-full px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              openMobileSidebar();
            }}
            aria-label={t("nav.openMenu")}
            className="lg:hidden flex min-h-11 min-w-11 h-11 w-11 shrink-0 items-center justify-center rounded-xl text-foreground hover:bg-muted cursor-pointer"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="lg:hidden">
            <PlatformHeaderBrand />
          </div>

          <Breadcrumb
            ariaLabel={t("common.breadcrumb")}
            className="hidden lg:flex min-w-0"
            items={breadcrumbItems}
          />

          <PlatformWorkspaceSwitcher />

          <Link
            to={ROUTES.platformSystem}
            className="hidden sm:inline-flex cursor-pointer shrink-0"
            title={t("platform.systemMaintenance")}
            aria-label={`${t("platform.systemMaintenance")}: ${healthLabel}`}
          >
            <Badge
              as="span"
              tone={
                status === "operational" ? "success" : status === "degraded" ? "warning" : "muted"
              }
              pill
              dot
              pulse={status !== "unknown"}
              size="sm"
              className="hover:opacity-85 transition-opacity cursor-pointer"
            >
              {healthLabel}
            </Badge>
          </Link>
        </div>

        <PlatformHeaderUserNav
          onOpenSearch={onOpenSearch}
          searchOpen={searchOpen}
          onOpenAi={onOpenAi}
          aiOpen={aiOpen}
          className="ms-auto shrink-0"
        />
      </div>
    </div>
  );
}
