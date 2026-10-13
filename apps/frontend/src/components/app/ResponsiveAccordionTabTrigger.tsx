import React from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AccordionTabItem } from "@/components/app/ResponsiveAccordionTabsTypes";

export function TabTrigger({
  tab,
  active,
  panelId,
  onTabChange,
}: {
  tab: AccordionTabItem;
  active: boolean;
  panelId: string;
  onTabChange: (id: string) => void;
}): React.JSX.Element {
  const Icon = tab.icon;
  const className = cn(
    "flex min-h-11 w-full items-start gap-3 px-4 py-3.5 text-start transition-colors rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
    active ? "text-primary" : "text-foreground hover:bg-muted/40",
  );
  const body = (
    <>
      {Icon ? (
        <span
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{tab.label}</span>
        {tab.description ? (
          <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
            {tab.description}
          </span>
        ) : null}
      </span>
      <ChevronDown
        className={cn(
          "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
          active && "rotate-180 text-primary",
        )}
        aria-hidden
      />
    </>
  );

  if (tab.href) {
    return (
      <Link to={tab.href} aria-expanded={active} aria-controls={panelId} className={className}>
        {body}
      </Link>
    );
  }

  return (
    <button
      type="button"
      aria-expanded={active}
      aria-controls={panelId}
      onClick={() => onTabChange(tab.id)}
      className={className}
    >
      {body}
    </button>
  );
}
