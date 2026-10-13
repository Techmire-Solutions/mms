import React from "react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MESSAGING_ICON_BTN } from "@/components/ui/messagingActionStyles";
import { cn } from "@/lib/utils";

export interface MessagingActionButtonProps {
  icon: LucideIcon;
  label: string;
  ariaLabel?: string;
  toneClass: string;
  href?: string | null;
  onClick?: () => void;
  targetBlank?: boolean;
}

export function MessagingActionButton({
  icon: Icon,
  label,
  ariaLabel,
  toneClass,
  href,
  onClick,
  targetBlank = false,
}: MessagingActionButtonProps): React.JSX.Element | null {
  const effectiveAria = ariaLabel ?? label;

  if (onClick) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className={cn(
              MESSAGING_ICON_BTN,
              toneClass,
              "inline-flex items-center justify-center select-none shadow-none",
            )}
            aria-label={effectiveAria}
          >
            <Icon aria-hidden="true" className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={4} className="text-xs">
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  if (href) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href={href}
            target={targetBlank ? "_blank" : undefined}
            rel={targetBlank ? "noopener noreferrer" : undefined}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              MESSAGING_ICON_BTN,
              toneClass,
              "inline-flex items-center justify-center select-none",
            )}
            aria-label={effectiveAria}
          >
            <Icon aria-hidden="true" className="h-4 w-4" />
          </a>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={4} className="text-xs">
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return null;
}
