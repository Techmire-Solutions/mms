import React from "react";
import { Search } from "lucide-react";
import TopBarActions from "@/tenant/components/layout/TopBarActions";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";

export interface TopBarProps {
  onOpenCommandPalette?: () => void;
}

/**
 * Global application top-bar header containing search and session controls.
 *
 * Positioning (fixed inset + start offset) is owned by `AppShell`'s desktop
 * `<header role="banner">` wrapper; this component renders the visible bar only.
 */
export default function TopBar({ onOpenCommandPalette }: TopBarProps): React.JSX.Element {
  const { t } = useTranslation();

  const shortcutText = (() => {
    if (typeof navigator === "undefined") return "⌘K";
    const isMac = /(Mac|iPhone|iPod|iPad)/i.test(navigator.platform || navigator.userAgent || "");
    return isMac ? "⌘K" : "Ctrl+K";
  })();

  return (
    <div className="flex h-16 w-full items-center gap-4 border-b border-border bg-card/80 px-4 backdrop-blur-xl sm:px-6">
      {/* Desktop: full pill with placeholder text */}
      <div className="hidden min-w-0 flex-1 md:flex md:max-w-md md:mx-auto">
        <Button
          type="button"
          variant="outline"
          onClick={onOpenCommandPalette}
          aria-keyshortcuts="Control+K Meta+K"
          className="relative flex w-full items-center justify-start rounded-xl border-border/50 bg-muted/50 ps-10 pe-16 min-h-11 h-11 text-sm font-normal text-muted-foreground text-start hover:bg-muted hover:text-foreground cursor-pointer shadow-none gap-2"
        >
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <span className="truncate flex-1">{t("nav.globalSearchPlaceholder")}</span>
          <kbd
            aria-hidden="true"
            className="ms-auto shrink-0 rounded border border-border bg-card px-1.5 py-0.5 text-xs text-muted-foreground font-mono select-none"
          >
            {shortcutText}
          </kbd>
        </Button>
      </div>

      {/* Mobile: compact icon button (Cmd+K affordance visible on all viewports) */}
      {onOpenCommandPalette && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onOpenCommandPalette}
          aria-label={t("nav.globalSearchPlaceholder")}
          aria-keyshortcuts="Control+K Meta+K"
          className="flex md:hidden min-h-11 min-w-11 h-11 w-11 rounded-xl hover:bg-muted transition-colors cursor-pointer"
        >
          <Search className="h-4.5 w-4.5 text-muted-foreground" aria-hidden="true" />
        </Button>
      )}

      <TopBarActions className="ms-auto" />
    </div>
  );
}
