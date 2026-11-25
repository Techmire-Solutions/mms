import React from "react";
import { Search } from "lucide-react";
import TopBarActions from "@/tenant/components/layout/TopBarActions";
import { Button } from "@mms/ui";
import { useTranslation } from "@mms/fe-core/i18n";

export interface TopBarProps {
  onOpenCommandPalette?: () => void;
}

/**
 * `Button` wraps children in its own `relative inline-flex` content spans, so an
 * absolutely positioned icon anchors to that span (where the text also starts),
 * not to the button padding. The icon therefore stays in the flex flow, and the
 * content spans are stretched full width and start-aligned so the placeholder
 * truncates and the shortcut hint sits at the inline end.
 */
const TOP_BAR_SEARCH_TRIGGER_CLASS = [
  "flex w-full justify-start min-h-11 h-11 px-3 gap-2 rounded-xl border-border/50 bg-muted/50 shadow-none",
  "text-sm font-normal text-muted-foreground text-start hover:bg-muted hover:text-foreground cursor-pointer",
  "[&>span]:w-full [&>span]:min-w-0",
  "[&_[data-slot=button-content]]:w-full [&_[data-slot=button-content]]:min-w-0 [&_[data-slot=button-content]]:justify-start",
].join(" ");

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
          className={TOP_BAR_SEARCH_TRIGGER_CLASS}
        >
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{t("nav.globalSearchPlaceholder")}</span>
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
