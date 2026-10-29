import React, { useState, useCallback, Suspense } from "react";
import { Outlet } from "react-router-dom";
import { ModuleScaffoldSkeleton } from "@/components/common/ModuleScaffold";
import { AppShell } from "@/components/common/AppShell";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppFooter } from "@/components/app/AppFooter";
import Sidebar from "@/tenant/components/layout/Sidebar";
import TopBar from "@/tenant/components/layout/TopBar";
import TopBarActions from "@/tenant/components/layout/TopBarActions";
import MobileSidebar from "@/tenant/components/layout/MobileSidebar";
const CommandPalette = React.lazy(() =>
  import("@/components/app/CommandPalette").then((m) => ({ default: m.CommandPalette })),
);
import { useBranding } from "@/tenant/hooks/useBranding";
import { getInitials } from "@mms/shared";
import { useSessionTimeout } from "@/tenant/hooks/useSessionTimeout";
import { LOGO_IMAGE } from "@/lib/ui/semanticTone";
import { useTranslation } from "@/hooks/useTranslation";
import { useGlobalShortcut } from "@/hooks/useGlobalShortcut";
import { useNavigationState } from "@/hooks/useNavigationState";
import { useInitializeUiState } from "@/tenant/hooks/useInitializeUiState";
import { useModuleAccess } from "@/tenant/hooks/useModuleAccess";
import { canShowRoute } from "@/lib/config/routeAccess";

/**
 * Main authenticated application shell layout. Orchestrates the primary sidebar,
 * top navigation bar, mobile-responsive layouts, and wraps nested router views.
 */
export default function AppLayout(): React.JSX.Element {
  const {
    collapsed: sidebarCollapsed,
    toggleCollapsed,
    mobileOpen,
    openMobileSidebar,
    closeMobileSidebar,
    commandPaletteOpen,
    openCommandPalette,
    closeCommandPalette,
    toggleCommandPalette,
  } = useNavigationState();
  const branding = useBranding();
  const { evaluate } = useModuleAccess();
  const isCommandPathVisible = useCallback(
    (path: string) => canShowRoute(new URL(path, "http://app.local").pathname, evaluate),
    [evaluate],
  );
  const { t } = useTranslation();
  const sessionTimeoutModal = useSessionTimeout();
  useInitializeUiState();

  useGlobalShortcut("k", toggleCommandPalette);

  const [logoError, setLogoError] = useState<boolean>(false);
  const [previousLogoUrl, setPreviousLogoUrl] = useState(branding.logoUrl);

  // Reset the broken-image flag during render when the branding logo changes.
  if (previousLogoUrl !== branding.logoUrl) {
    setPreviousLogoUrl(branding.logoUrl);
    setLogoError(false);
  }

  return (
    <AppShell
      sidebar={<Sidebar collapsed={sidebarCollapsed} onToggle={toggleCollapsed} />}
      mobileSidebar={<MobileSidebar open={mobileOpen} onClose={closeMobileSidebar} />}
      topBar={
        <TopBar sidebarCollapsed={sidebarCollapsed} onOpenCommandPalette={openCommandPalette} />
      }
      mobileHeader={
        <div className="flex h-14 w-full items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur-md">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("nav.openMenu")}
            onClick={(event) => {
              event.stopPropagation();
              openMobileSidebar();
            }}
            className="shrink-0 rounded-lg transition-colors hover:bg-muted"
          >
            <Menu className="h-5 w-5 text-foreground" />
          </Button>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {branding.logoUrl && !logoError ? (
              <img
                src={branding.logoUrl}
                alt="Logo"
                className={`h-7 w-7 max-w-full shrink-0 rounded-md ${LOGO_IMAGE}`}
                width={28}
                height={28}
                loading="eager"
                decoding="async"
                fetchPriority="high"
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
                <span className="font-display text-sm font-bold text-primary">
                  {branding.madrasaName ? getInitials(branding.madrasaName, 1) : "م"}
                </span>
              </div>
            )}
            <span className="min-w-0 truncate text-sm font-semibold">
              {branding.madrasaName || t("entry.productName")}
            </span>
          </div>
          <TopBarActions compact onOpenCommandPalette={openCommandPalette} />
        </div>
      }
      commandPalette={
        commandPaletteOpen ? (
          <Suspense fallback={null}>
            <CommandPalette
              open={commandPaletteOpen}
              onClose={closeCommandPalette}
              isPathVisible={isCommandPathVisible}
            />
          </Suspense>
        ) : null
      }
      extraModals={sessionTimeoutModal}
      sidebarCollapsed={sidebarCollapsed}
      footer={
        <AppFooter
          text={branding.footerText || undefined}
          name={branding.madrasaName || undefined}
        />
      }
    >
      <Suspense fallback={<ModuleScaffoldSkeleton />}>
        <Outlet />
      </Suspense>
    </AppShell>
  );
}
