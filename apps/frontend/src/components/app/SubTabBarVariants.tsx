import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { SubTabBarBadge } from "@/components/app/SubTabBarBadge";
import {
  SubTabBarAccordionVariant,
  type SubTabBarAccordionVariantProps,
  type SubTabBarVariantProps,
} from "@/components/app/SubTabBarAccordionVariant";

export { SubTabBarAccordionVariant };
export type { SubTabBarAccordionVariantProps, SubTabBarVariantProps };

export function SubTabBarUnderlineVariant<K extends string>({
  tabs,
  value,
  onChange,
  className,
  panelIdPrefix,
  children,
}: SubTabBarVariantProps<K> & { children?: React.ReactNode }): React.JSX.Element {
  return (
    <div className={cn("w-full space-y-3", className)}>
      <div
        role="tablist"
        aria-orientation="horizontal"
        className="flex w-full items-center gap-1 border-b border-border/40 overflow-x-auto no-scrollbar mask-fade-inline-end"
      >
        {tabs.map((tab) => {
          const active = value === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.key)}
              className={cn(
                "group relative flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-t-lg px-3.5 py-2 text-xs sm:text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                active
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
              )}
            >
              {tab.icon && (
                <tab.icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                  )}
                  aria-hidden="true"
                />
              )}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <SubTabBarBadge badge={tab.badge} active={active} interactive />
              )}
              {active && (
                <motion.div
                  layoutId={`${panelIdPrefix}-underline`}
                  className="absolute -bottom-px inset-x-0 h-0.5 bg-primary rounded-full"
                  transition={{ type: "spring", stiffness: 450, damping: 35 }}
                />
              )}
            </button>
          );
        })}
      </div>
      {children}
    </div>
  );
}

export function SubTabBarPillVariant<K extends string>({
  tabs,
  value,
  onChange,
  className,
}: SubTabBarVariantProps<K>): React.JSX.Element {
  return (
    <div className={cn("space-y-2", className)}>
      <div role="tablist" aria-orientation="vertical" className="space-y-1 lg:hidden">
        {tabs.map((tab) => {
          const active = value === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.key)}
              className={cn(
                "flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-start text-xs font-semibold transition-colors cursor-pointer",
                active
                  ? "border-primary/20 bg-card text-primary shadow-xs font-bold"
                  : "border-border/60 bg-muted/20 text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                {tab.icon && <tab.icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                <span className="truncate">{tab.label}</span>
              </span>
              {tab.badge !== undefined && <SubTabBarBadge badge={tab.badge} active={active} />}
            </button>
          );
        })}
      </div>
      <div
        role="tablist"
        aria-orientation="horizontal"
        className="hidden w-fit items-center gap-1 overflow-x-auto rounded-xl bg-muted/60 p-1 border border-border/40 backdrop-blur-xs lg:flex"
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
                "relative flex min-h-11 min-w-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs sm:text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer",
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
                  aria-hidden="true"
                />
              )}
              <span>{t.label}</span>
              {t.badge !== undefined && <SubTabBarBadge badge={t.badge} active={active} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
