import React, { Fragment } from "react";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface ActiveFilterBannerChip {
  key: string;
  label?: string;
  value: string;
}

export interface ActiveFilterBannerAction {
  key: string;
  label: string;
  onClick: () => void;
}

export interface ActiveFilterBannerProps {
  /** Optional global label rendered once before the chips (e.g. Student "Filters"). */
  label?: string;
  chips: readonly ActiveFilterBannerChip[];
  actions: readonly ActiveFilterBannerAction[];
}

/** Canonical active-filter banner chrome — SSOT for report filter pills/clear actions. */
export function ActiveFilterBanner({
  label,
  chips,
  actions,
}: ActiveFilterBannerProps): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground">
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
        {label && <span className="font-medium text-foreground">{label}</span>}
        {chips.map((chip) => (
          <Fragment key={chip.key}>
            {chip.label && <span className="font-medium text-foreground">{chip.label}</span>}
            <Badge tone="primary" size="sm" as="span">
              {chip.value}
            </Badge>
          </Fragment>
        ))}
      </div>
      <div className="flex items-center gap-1">
        {actions.map((action) => (
          <Button
            key={action.key}
            type="button"
            variant="ghost"
            size="sm"
            onClick={action.onClick}
            className="min-h-11 px-2 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="w-3 h-3 me-1" aria-hidden="true" />
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
