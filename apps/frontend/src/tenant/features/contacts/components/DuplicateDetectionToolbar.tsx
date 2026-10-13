import React from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LeadingIconInput } from "@/components/app/LeadingIconInput";
import type { DuplicateTierFilter } from "@/tenant/features/contacts/hooks/useDuplicateDetectionState";

export interface DuplicateDetectionToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  tierFilter: DuplicateTierFilter;
  onTierFilterChange: (tier: DuplicateTierFilter) => void;
  filterTabs: Array<{ id: DuplicateTierFilter; label: string; count: number }>;
  searchPlaceholder: string;
}

export function DuplicateDetectionToolbar({
  searchQuery,
  onSearchChange,
  tierFilter,
  onTierFilterChange,
  filterTabs,
  searchPlaceholder,
}: DuplicateDetectionToolbarProps): React.JSX.Element {
  return (
    <div className="space-y-2.5 pb-1">
      <LeadingIconInput
        icon={Search}
        type="search"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={searchPlaceholder}
        aria-label={searchPlaceholder}
      />

      <div className="flex flex-wrap gap-2 border-b border-border/60 pb-2.5">
        {filterTabs.map((tab) => {
          const active = tierFilter === tab.id;
          return (
            <Button
              key={tab.id}
              type="button"
              variant={active ? "default" : "secondary"}
              aria-pressed={active}
              onClick={() => onTierFilterChange(tab.id)}
              className={`min-h-11 rounded-xl px-3.5 py-2 text-xs font-semibold gap-1.5 shadow-none ${
                active
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span>{tab.label}</span>
              <Badge
                pill
                variant="outline"
                className={`px-1.5 py-0 text-xs font-bold ${
                  active
                    ? "bg-primary-foreground/20 text-primary-foreground border-transparent"
                    : "border-border/60"
                }`}
              >
                {tab.count}
              </Badge>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
