import type React from "react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/app/CopyButton";
import {
  MESSAGING_ICON_BTN,
  MESSAGING_ICON_BTN_TONES,
} from "@/components/app/messagingActionStyles";
import { cn } from "@/lib/utils";

export interface CollectionRowAction {
  key: string;
  icon: LucideIcon;
  title: string;
  href?: string;
  onClick?: () => void;
  className?: string;
  external?: boolean;
}

export interface CollectionRowItemProps {
  label: string;
  value: string;
  copyable?: boolean;
  actions?: CollectionRowAction[];
}

function RowActionButton({ action }: { action: CollectionRowAction }): React.JSX.Element {
  const Icon = action.icon;
  const className = action.className
    ? cn("inline-flex items-center justify-center", action.className)
    : cn(
        MESSAGING_ICON_BTN,
        MESSAGING_ICON_BTN_TONES.link,
        "inline-flex items-center justify-center",
      );

  if (action.href) {
    return (
      <a
        href={action.href}
        target={action.external ? "_blank" : undefined}
        rel={action.external ? "noopener noreferrer" : undefined}
        aria-label={action.title}
        title={action.title}
        className={className}
      >
        <Icon className="h-3.5 w-3.5" />
      </a>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={action.onClick}
      aria-label={action.title}
      title={action.title}
      className={cn("shadow-none", className)}
    >
      <Icon className="h-3.5 w-3.5" />
    </Button>
  );
}

export function CollectionRowItem({
  label,
  value,
  copyable = true,
  actions,
}: CollectionRowItemProps): React.JSX.Element {
  return (
    <div className="p-3 border-b border-border/50 last:border-b-0 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 uppercase">
            {label}
          </span>
        </div>
        <span className="font-semibold text-xs text-foreground block leading-relaxed truncate">
          {value}
        </span>
      </div>
      {value && (
        <div className="flex max-w-3/5 flex-shrink-0 flex-wrap items-center justify-end gap-1">
          {copyable && (
            <CopyButton
              text={value}
              showToast
              className={cn(
                MESSAGING_ICON_BTN,
                MESSAGING_ICON_BTN_TONES.copy,
                "flex items-center justify-center opacity-100",
              )}
            />
          )}
          {(actions ?? []).map((action) => (
            <RowActionButton key={action.key} action={action} />
          ))}
        </div>
      )}
    </div>
  );
}
