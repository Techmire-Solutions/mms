import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SubTab } from "@/components/ui/SubTabBar";
import { SubTabBarBadge } from "@/components/ui/SubTabBarBadge";

export interface SubTabBarVariantProps<K extends string> {
  tabs: readonly SubTab<K>[];
  value: K;
  onChange: (key: K) => void;
  className?: string;
  panelIdPrefix: string;
}

export interface SubTabBarAccordionVariantProps<K extends string> extends SubTabBarVariantProps<K> {
  children: React.ReactNode;
  sectionRefs: React.MutableRefObject<Partial<Record<string, HTMLElement | null>>>;
}

function SubTabBarDesktopPillList<K extends string>({
  tabs,
  value,
  onChange,
}: Pick<SubTabBarVariantProps<K>, "tabs" | "value" | "onChange">): React.JSX.Element {
  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className="flex w-fit items-center gap-1 rounded-xl bg-muted/60 p-1 border border-border/40 backdrop-blur-xs"
    >
      {tabs.map((t) => {
        const active = value === t.key;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className={cn(
              "relative flex min-h-11 min-w-11 items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              active
                ? "bg-card text-foreground font-semibold shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground hover:bg-card/40",
            )}
          >
            {t.icon && (
              <t.icon
                className={cn(
                  "h-3.5 w-3.5 transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
                aria-hidden
              />
            )}
            <span>{t.label}</span>
            {t.badge !== undefined && <SubTabBarBadge badge={t.badge} active={active} />}
          </button>
        );
      })}
    </div>
  );
}

export function SubTabBarAccordionVariant<K extends string>({
  tabs,
  value,
  onChange,
  className,
  panelIdPrefix,
  children,
  sectionRefs,
}: SubTabBarAccordionVariantProps<K>): React.JSX.Element {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="space-y-2 lg:hidden">
        {tabs.map((tab) => {
          const active = value === tab.key;
          const panelId = `${panelIdPrefix}-${tab.key}`;
          return (
            <section
              key={tab.key}
              ref={(node) => {
                sectionRefs.current[tab.key] = node;
              }}
              className={cn(
                "overflow-hidden rounded-lg border transition-colors",
                active ? "border-primary/20 bg-muted/30" : "border-border/60 bg-muted/10",
              )}
            >
              <button
                type="button"
                aria-expanded={active}
                aria-controls={panelId}
                onClick={() => onChange(tab.key)}
                className={cn(
                  "flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2.5 text-start text-xs font-semibold transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="flex items-center gap-1.5">
                  {tab.icon && <tab.icon className="h-3.5 w-3.5" aria-hidden />}
                  <span>{tab.label}</span>
                </span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                    active && "rotate-180 text-primary",
                  )}
                  aria-hidden
                />
              </button>
              <AnimatePresence initial={false}>
                {active ? (
                  <motion.div
                    id={panelId}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-3 border-t border-border/50 px-3 py-3">{children}</div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </section>
          );
        })}
      </div>

      <div className="hidden lg:block space-y-3">
        <SubTabBarDesktopPillList tabs={tabs} value={value} onChange={onChange} />
        {children}
      </div>
    </div>
  );
}
