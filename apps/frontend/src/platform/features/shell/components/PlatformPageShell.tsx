import React, { Suspense, useState } from "react";
import { Outlet } from "react-router-dom";
import { usePlatformAuth } from "@/platform/features/auth/lib/PlatformAuthContext";
import { usePlatformPermissions } from "@/platform/hooks/usePlatformPermissions";
import { AppPageShellSkeleton } from "@/components/common";
import {
  PlatformSidebarProvider,
  usePlatformSidebar,
} from "@/platform/features/shell/lib/PlatformSidebarContext";
import { PlatformBreadcrumbProvider } from "@/platform/features/shell/lib/PlatformBreadcrumbContext";
import { PlatformInspectorProvider } from "@/platform/features/shell/lib/PlatformInspectorContext";
import { useGlobalShortcut } from "@/hooks/useGlobalShortcut";
import { PlatformPageShellHeader } from "@/platform/features/shell/components/PlatformPageShellHeader";
import {
  PlatformSidebar,
  PlatformMobileSidebar,
} from "@/platform/features/shell/components/sidebar/PlatformSidebar";
import { PlatformCommandPalette } from "@/platform/features/shell/components/command/PlatformCommandPalette";
import { PlatformAiDrawer } from "@/platform/features/ai/components/PlatformAiDrawer";
import { PlatformInspectorDrawer } from "@/platform/features/shell/components/inspector/PlatformInspectorDrawer";
import { AppShell } from "@/components/common/AppShell";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";
import { AppFooter, LiveRegionProvider, TooltipProvider } from "@mms/ui";

/**
 * Page-level fault isolation for platform console pages.
 *
 * Tenant pages get this from `AppPageShell`; without it a single render error
 * on a console page replaced the whole apex app with the root fallback (nav and
 * all). Only the page subtree is replaced here.
 */
export function PlatformPageBoundary({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

const MAX_W: Record<NonNullable<PlatformPageShellProps["width"]>, string> = {
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "7xl": "w-full max-w-full",
};

interface PlatformPageShellProps {
  children?: React.ReactNode;
  /** Max content width — default `lg` for console-style pages. */
  width?: "md" | "lg" | "xl" | "7xl";
}

/** Registers the Cmd/Ctrl+K and Cmd/Ctrl+J shortcuts. */
function PlatformGlobalShortcuts({ onToggleAi }: { onToggleAi?: () => void }): null {
  const { setCommandPaletteOpen } = usePlatformSidebar();
  useGlobalShortcut("k", () => setCommandPaletteOpen((prev) => !prev));
  useGlobalShortcut("j", () => onToggleAi?.());
  return null;
}

/** Inner component that reads command palette & AI copilot state. */
function PlatformAuthenticatedShell({
  children,
  maxClass,
  footer,
}: {
  children: React.ReactNode;
  maxClass: string;
  footer: React.ReactNode;
}): React.JSX.Element {
  const { canSystem } = usePlatformPermissions();
  const { commandPaletteOpen, setCommandPaletteOpen, collapsed } = usePlatformSidebar();
  const [aiOpen, setAiOpen] = useState(false);
  const openAi = canSystem ? () => setAiOpen(true) : undefined;
  const toggleAi = canSystem ? () => setAiOpen((prev) => !prev) : undefined;

  return (
    <AppShell
      dir="ltr"
      lang="en"
      sidebar={<PlatformSidebar />}
      mobileSidebar={<PlatformMobileSidebar />}
      topBar={
        <PlatformPageShellHeader
          onOpenSearch={() => setCommandPaletteOpen(true)}
          searchOpen={commandPaletteOpen}
          onOpenAi={openAi}
          aiOpen={aiOpen}
        />
      }
      mobileHeader={
        <PlatformPageShellHeader
          onOpenSearch={() => setCommandPaletteOpen(true)}
          searchOpen={commandPaletteOpen}
          onOpenAi={openAi}
          aiOpen={aiOpen}
        />
      }
      commandPalette={
        <PlatformCommandPalette
          open={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
          onOpenAi={openAi}
        />
      }
      sidebarCollapsed={collapsed}
      maxWidthClass={maxClass}
      footer={footer}
    >
      <PlatformGlobalShortcuts onToggleAi={toggleAi} />
      <PlatformPageBoundary>{children}</PlatformPageBoundary>
      <PlatformInspectorDrawer />
      {canSystem ? <PlatformAiDrawer isOpen={aiOpen} onClose={() => setAiOpen(false)} /> : null}
    </AppShell>
  );
}

/** Shared apex platform page layout — English/LTR only, matching Tenant AppLayout standards. */
export function PlatformPageShell({
  children,
  width = "lg",
}: PlatformPageShellProps): React.JSX.Element {
  const { isPlatformAuthenticated } = usePlatformAuth();
  const maxClass = MAX_W[width] ?? "w-full max-w-full";
  const footer = <AppFooter className="mt-auto" />;

  return (
    <LiveRegionProvider>
      <TooltipProvider delayDuration={150}>
        <PlatformSidebarProvider>
          <PlatformBreadcrumbProvider>
            <PlatformInspectorProvider>
              {isPlatformAuthenticated ? (
                <PlatformAuthenticatedShell maxClass={maxClass} footer={footer}>
                  {children || (
                    <Suspense fallback={<AppPageShellSkeleton />}>
                      <Outlet />
                    </Suspense>
                  )}
                </PlatformAuthenticatedShell>
              ) : (
                <UnauthenticatedShell maxClass={maxClass} footer={footer}>
                  {children || (
                    <Suspense fallback={<AppPageShellSkeleton />}>
                      <Outlet />
                    </Suspense>
                  )}
                </UnauthenticatedShell>
              )}
            </PlatformInspectorProvider>
          </PlatformBreadcrumbProvider>
        </PlatformSidebarProvider>
      </TooltipProvider>
    </LiveRegionProvider>
  );
}

function UnauthenticatedShell({
  maxClass,
  children,
  footer,
}: {
  maxClass: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}): React.JSX.Element {
  const { commandPaletteOpen, setCommandPaletteOpen } = usePlatformSidebar();

  return (
    <AppShell
      dir="ltr"
      lang="en"
      topBar={
        <PlatformPageShellHeader
          onOpenSearch={() => setCommandPaletteOpen(true)}
          searchOpen={commandPaletteOpen}
        />
      }
      mobileHeader={
        <PlatformPageShellHeader
          onOpenSearch={() => setCommandPaletteOpen(true)}
          searchOpen={commandPaletteOpen}
        />
      }
      commandPalette={
        <PlatformCommandPalette
          open={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
        />
      }
      maxWidthClass={maxClass}
      footer={footer}
    >
      <PlatformGlobalShortcuts />
      <PlatformPageBoundary>{children}</PlatformPageBoundary>
    </AppShell>
  );
}
