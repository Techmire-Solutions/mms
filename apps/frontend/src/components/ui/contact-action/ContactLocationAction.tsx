import React, { type ReactNode } from "react";
import { MapPin } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WORK_SURFACE_INNER } from "@/components/ui/formStyles";
import { MESSAGING_ICON_BTN_TONES } from "@/components/ui/messagingActionStyles";
import { cn } from "@/lib/utils";
import {
  ActionCopyButton,
  ActionIconButton,
  type ContactActionVariant,
} from "./contactActionShared";

export interface ContactLocationActionProps {
  /** Physical address text or map search query */
  address?: string | null;
  /** Address display text (if different from query) */
  addressDisplay?: string | null;
  /** Custom map URL (defaults to Google Maps search query) */
  mapsHref?: string | null;
  /** Optional address label (e.g. "Home", "Office") */
  label?: string;
  /** Visual presentation variant. Default is "stacked". */
  variant?: ContactActionVariant;
  /** Whether to show the Copy button. Default true. */
  showCopy?: boolean;
  /** Whether interaction is disabled */
  disabled?: boolean;
  /** Custom fallback element when address is empty */
  emptyFallback?: ReactNode;
  /** Toast message shown upon copying */
  copyToast?: string;
  /** Optional custom labels */
  labels?: {
    location?: string;
    copy?: string;
    copied?: string;
  };
  className?: string;
}

/**
 * Reusable location / address action component with Map and Copy buttons.
 */
export const ContactLocationAction = function ContactLocationAction({
  address,
  addressDisplay,
  mapsHref,
  label,
  variant = "stacked",
  showCopy = true,
  disabled = false,
  emptyFallback = null,
  copyToast,
  labels,
  className,
}: ContactLocationActionProps): React.JSX.Element | null {
  const cleanAddress = (address || "").trim();
  const displayText = (addressDisplay || cleanAddress).trim();

  if (!cleanAddress && !displayText) {
    return <>{emptyFallback}</>;
  }

  const effectiveMapsHref =
    mapsHref ||
    (cleanAddress ? `https://maps.google.com/?q=${encodeURIComponent(cleanAddress)}` : null);

  const locationLabel = labels?.location || "Open in Maps";
  const copyLabel = labels?.copy || "Copy";
  const copiedLabel = labels?.copied || "Copied";

  const actionsNode = (
    <div className="flex items-center gap-1 shrink-0 select-none">
      {effectiveMapsHref && !disabled ? (
        <ActionIconButton
          icon={MapPin}
          label={locationLabel}
          tooltipText={locationLabel}
          href={effectiveMapsHref}
          target="_blank"
          rel="noopener noreferrer"
          toneClass={MESSAGING_ICON_BTN_TONES.location}
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
            <MapPin
              aria-hidden="true"
              className="w-3.5 h-3.5 text-warning/80 flex-shrink-0 group-hover/pill:text-warning transition-colors"
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
      <div className={cn("flex min-w-0 flex-col items-start gap-1 group/location", className)}>
        {valueDisplayNode}
        {actionsNode}
      </div>
    </TooltipProvider>
  );
};
