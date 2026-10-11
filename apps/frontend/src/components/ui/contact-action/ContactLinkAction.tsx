import React, { type ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WORK_SURFACE_INNER } from "@/components/ui/formStyles";
import { MESSAGING_ICON_BTN_TONES } from "@/components/ui/messagingActionStyles";
import { cn } from "@/lib/utils";
import {
  ActionCopyButton,
  ActionIconButton,
  type ContactActionVariant,
} from "./contactActionShared";

export interface ContactLinkActionProps {
  /** Target link URL */
  href?: string | null;
  /** Display label / URL string */
  text?: string | null;
  /** Optional link tag or platform label */
  label?: string;
  /** Visual presentation variant. Default is "stacked". */
  variant?: ContactActionVariant;
  /** Whether to show the Copy button. Default true. */
  showCopy?: boolean;
  /** Whether interaction is disabled */
  disabled?: boolean;
  /** Custom fallback element when link is empty */
  emptyFallback?: ReactNode;
  /** Toast message shown upon copying */
  copyToast?: string;
  /** Optional custom labels */
  labels?: {
    link?: string;
    copy?: string;
    copied?: string;
  };
  className?: string;
}

/**
 * Reusable link / website action component with ExternalLink and Copy buttons.
 */
export const ContactLinkAction = function ContactLinkAction({
  href,
  text,
  label,
  variant = "stacked",
  showCopy = true,
  disabled = false,
  emptyFallback = null,
  copyToast,
  labels,
  className,
}: ContactLinkActionProps): React.JSX.Element | null {
  const cleanHref = (href || "").trim();
  const displayText = (text || cleanHref).trim();

  if (!cleanHref && !displayText) {
    return <>{emptyFallback}</>;
  }

  const effectiveUrl =
    cleanHref.startsWith("http://") || cleanHref.startsWith("https://")
      ? cleanHref
      : cleanHref
        ? `https://${cleanHref}`
        : null;

  const linkLabel = labels?.link || "Open Link";
  const copyLabel = labels?.copy || "Copy";
  const copiedLabel = labels?.copied || "Copied";

  const actionsNode = (
    <div className="flex items-center gap-1 shrink-0 select-none">
      {effectiveUrl && !disabled ? (
        <ActionIconButton
          icon={ExternalLink}
          label={linkLabel}
          tooltipText={linkLabel}
          href={effectiveUrl}
          target="_blank"
          rel="noopener noreferrer"
          toneClass={MESSAGING_ICON_BTN_TONES.link}
        />
      ) : null}
      {showCopy && displayText && !disabled ? (
        <ActionCopyButton
          text={displayText}
          copyToastMessage={copyToast}
          tooltipCopyText={copyLabel}
          tooltipCopiedText={copiedLabel}
        />
      ) : null}
    </div>
  );

  if (variant === "actions-only") {
    return <TooltipProvider delayDuration={200}>{actionsNode}</TooltipProvider>;
  }

  if (variant === "pill") {
    return (
      <TooltipProvider delayDuration={200}>
        <div
          className={cn(
            WORK_SURFACE_INNER,
            "w-full flex items-center justify-between text-xs font-normal text-muted-foreground hover:bg-muted/65 hover:text-foreground px-3 py-1.5 rounded-xl group/pill min-w-0 transition-colors gap-2",
            className,
          )}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1 pe-2">
            <ExternalLink
              aria-hidden="true"
              className="w-3.5 h-3.5 text-primary/80 flex-shrink-0 group-hover/pill:text-primary transition-colors"
            />
            <span className="font-semibold tracking-tight truncate select-all">{displayText}</span>
            {label ? (
              <span className="text-2xs uppercase font-bold px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground shrink-0">
                {label}
              </span>
            ) : null}
          </div>
          {actionsNode}
        </div>
      </TooltipProvider>
    );
  }

  const valueDisplayNode = (
    <span
      className="max-w-full truncate text-sm text-muted-foreground font-medium select-all"
      title={displayText}
    >
      {displayText}
      {label ? <span className="ms-1.5 text-xs font-normal">({label})</span> : null}
    </span>
  );

  if (variant === "inline") {
    return (
      <TooltipProvider delayDuration={200}>
        <div className={cn("flex min-w-0 flex-wrap items-center gap-2", className)}>
          {valueDisplayNode}
          {actionsNode}
        </div>
      </TooltipProvider>
    );
  }

  // Default: stacked layout
  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn("flex min-w-0 flex-col items-start gap-1 group/link", className)}>
        {valueDisplayNode}
        {actionsNode}
      </div>
    </TooltipProvider>
  );
};
