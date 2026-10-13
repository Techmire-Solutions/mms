import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { SubTab } from "@/components/app/SubTabBar";
import { cn } from "@/lib/utils";

interface FormModalTabsProps<K extends string = string> {
  tabs: readonly SubTab<K>[];
  activeTab: K;
  onTabChange: (key: K) => void;
  dir?: "ltr" | "rtl";
  children: React.ReactNode;
}

/**
 * Form tabs layout tracks the FormModal container width (`@container`), not the
 * viewport — so half-desktop and full-desktop keep the same chrome while the
 * dialog stays max-w-2xl.
 */
export const FormModalTabs = function FormModalTabs<K extends string = string>({
  tabs,
  activeTab,
  onTabChange,
  dir,
  children,
}: FormModalTabsProps<K>): React.JSX.Element {
  const tabContentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (!tabContentRef.current) return;
      const firstInput = tabContentRef.current.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [role="combobox"]:not([aria-disabled="true"])',
      );
      if (firstInput && document.activeElement !== firstInput) {
        firstInput.focus({ preventScroll: true });
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [activeTab]);

  return (
    <TabsPrimitive.Root
      value={activeTab}
      onValueChange={(val) => onTabChange(val as K)}
      orientation="vertical"
      dir={dir}
      className="flex h-full min-h-0 flex-1 flex-col items-stretch gap-4 md:flex-row md:gap-6 @md:flex-row @md:gap-6"
    >
      <TabsPrimitive.List
        className={cn(
          "flex h-auto w-full shrink-0 flex-row gap-1 overflow-x-auto rounded-xl border border-border bg-muted/20 p-1.5",
          "md:w-56 md:min-w-56 md:flex-col md:overflow-x-visible md:overflow-y-auto md:rounded-none md:border-0 md:border-e md:border-border/60 md:bg-transparent md:p-0 md:pe-4 md:space-y-1",
          "@md:w-56 @md:min-w-56 @md:flex-col @md:overflow-x-visible @md:overflow-y-auto @md:rounded-none @md:border-0 @md:border-e @md:border-border/60 @md:bg-transparent @md:p-0 @md:pe-4 @md:space-y-1",
        )}
      >
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          const Icon = tab.icon;
          const accessibleLabel =
            tab.badge !== undefined ? `${tab.label} (${tab.badge})` : tab.label;
          return (
            <button
              type="button"
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              aria-label={accessibleLabel}
              title={tab.label}
              aria-selected={active}
              role="tab"
              className={cn(
                "relative flex min-h-11 cursor-pointer items-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                "flex-1 justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold whitespace-nowrap",
                "md:w-full md:flex-initial md:justify-start md:gap-2.5 md:rounded-xl md:px-3.5 md:py-2.5 md:text-sm",
                "@md:w-full @md:flex-initial @md:justify-start @md:gap-2.5 @md:rounded-xl @md:px-3.5 @md:py-2.5 @md:text-sm",
                active
                  ? "border border-border/80 bg-card font-bold text-foreground shadow-xs dark:bg-card/80"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent",
              )}
            >
              {Icon && (
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors md:h-4 md:w-4",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                  aria-hidden
                />
              )}
              <span className="truncate">{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  aria-hidden
                  className={cn(
                    "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-2xs font-extrabold transition-colors ms-auto",
                    "md:static md:ms-auto md:h-auto md:min-w-0 md:px-1.5 md:py-0.5",
                    "@md:static @md:ms-auto @md:h-auto @md:min-w-0 @md:px-1.5 @md:py-0.5",
                    tab.tone === "destructive"
                      ? "bg-destructive text-destructive-foreground"
                      : active
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </TabsPrimitive.List>

      <div ref={tabContentRef} className="min-w-0 flex-1 overflow-y-auto pe-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={String(activeTab)}
            initial={{ opacity: 0, x: 6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.12 }}
            className="h-full"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </TabsPrimitive.Root>
  );
} as <K extends string = string>(props: FormModalTabsProps<K>) => React.JSX.Element;
