import React from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { AccordionTabItem } from "@/components/ui/ResponsiveAccordionTabsTypes";

interface ResponsiveAccordionTabsDesktopProps {
  tabs: ReadonlyArray<AccordionTabItem>;
  activeTab: string;
  desktopLayout: "horizontal" | "sidebar";
  panelContent: React.ReactNode;
  onTabChange: (tabId: string) => void;
  sectionAriaLabel: string;
}

export function ResponsiveAccordionTabsDesktop({
  tabs,
  activeTab,
  desktopLayout,
  panelContent,
  onTabChange,
  sectionAriaLabel,
}: ResponsiveAccordionTabsDesktopProps): React.JSX.Element {
  if (desktopLayout === "horizontal") {
    return (
      <div className="space-y-4">
        <div
          role="tablist"
          aria-label={sectionAriaLabel}
          className="flex gap-0 overflow-x-auto border-b border-border"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            const tabClass = cn(
              "flex min-h-11 items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition-all rounded-t-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              active
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            );

            if (tab.href) {
              return (
                <Link
                  key={tab.id}
                  to={tab.href}
                  role="tab"
                  aria-selected={active}
                  className={tabClass}
                >
                  {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
                  {tab.label}
                </Link>
              );
            }

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onTabChange(tab.id)}
                className={tabClass}
              >
                {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
                {tab.label}
              </button>
            );
          })}
        </div>
        {panelContent}
      </div>
    );
  }

  return (
    <div className="flex gap-5 items-start">
      <nav
        aria-label={sectionAriaLabel}
        className="sticky top-header w-sidebar-mobile shrink-0 space-y-0.5 rounded-2xl border border-border/70 bg-card/70 p-2 shadow-sm backdrop-blur-sm"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          const linkClass = cn(
            "block w-full min-h-11 rounded-xl border px-3 py-2.5 text-start transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            active
              ? "border-primary/25 border-s-2 border-s-primary bg-primary/5 text-primary shadow-sm"
              : "border-transparent text-muted-foreground hover:border-border/50 hover:bg-muted/50 hover:text-foreground",
          );

          if (tab.href) {
            return (
              <Link key={tab.id} to={tab.href} className={linkClass}>
                <div className="mb-0.5 flex items-center gap-2">
                  {Icon ? (
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                        active ? "bg-primary/15 text-primary" : "bg-muted/80 text-muted-foreground",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                    </span>
                  ) : null}
                  <span className="text-sm font-semibold">{tab.label}</span>
                </div>
                {tab.description ? (
                  <p
                    className={cn(
                      "text-xs leading-snug text-muted-foreground",
                      Icon && "ps-9",
                      active && "text-primary/80",
                    )}
                  >
                    {tab.description}
                  </p>
                ) : null}
              </Link>
            );
          }

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={linkClass}
            >
              <div className="mb-0.5 flex items-center gap-2">
                {Icon ? (
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                      active ? "bg-primary/15 text-primary" : "bg-muted/80 text-muted-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                  </span>
                ) : null}
                <span className="text-sm font-semibold">{tab.label}</span>
              </div>
              {tab.description ? (
                <p
                  className={cn(
                    "text-xs leading-snug text-muted-foreground",
                    Icon && "ps-9",
                    active && "text-primary/80",
                  )}
                >
                  {tab.description}
                </p>
              ) : null}
            </button>
          );
        })}
      </nav>
      <div className="min-w-0 flex-1 rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm backdrop-blur-sm lg:p-6">
        {panelContent}
      </div>
    </div>
  );
}
