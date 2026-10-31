import React, { type ReactNode } from "react";
import { Mail } from "lucide-react";
import { sanitizeEmailForMailto } from "@mms/shared";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WORK_SURFACE_INNER } from "@/components/ui/formStyles";
import { MESSAGING_ICON_BTN_TONES } from "@/components/app/messagingActionStyles";
import { cn } from "@/lib/utils";
import {
  ActionCopyButton,
  ActionIconButton,
  type ContactActionVariant,
} from "./contactActionShared";

export interface ContactEmailActionProps {
  /** Email address */
  email?: string | null;
  /** Contact display name for aria-labels and tooltips */
  name?: string;
  /** Visual presentation variant. Default is "stacked". */
  variant?: ContactActionVariant;
  /** Whether to show the Copy button. Default true. */
  showCopy?: boolean;
  /** Whether to show the Mail mailto: action. Default true. */
  showMail?: boolean;
  /** Custom handler for Email click. If omitted, opens mailto:... */
  onEmail?: () => void;
  /** When true, disable/hide actions (e.g. archived records). */
  disabled?: boolean;
  /** Fallback placeholder when email is null/empty. Default is "—". */
  emptyFallback?: ReactNode;
  /** Toast message on copy */
  copyToast?: string;
  /** Custom container class */
  className?: string;
  /** Custom action buttons row class */
  actionsClassName?: string;
  /** Custom labels for action tooltips / aria */
  labels?: {
    mail?: string;
    copy?: string;
    copied?: string;
  };
}

export const ContactEmailAction = function ContactEmailAction({
  email,
  name,
  variant = "stacked",
  showCopy = true,
  showMail = true,
  onEmail,
  disabled = false,
  emptyFallback = <span className="text-sm text-muted-foreground">—</span>,
  copyToast,
  className,
  actionsClassName,
  labels,
}: ContactEmailActionProps): React.JSX.Element | null {
  const cleanEmail = (email || "").trim();

  if (!cleanEmail) {
    return emptyFallback ? <>{emptyFallback}</> : null;
  }

  const mailHref = sanitizeEmailForMailto(cleanEmail);
  const canMail = showMail && !disabled && (Boolean(mailHref) || Boolean(onEmail));
  const canCopy = showCopy && Boolean(cleanEmail);

  const targetName = name ? ` (${name})` : "";
  const mailLabel = labels?.mail
    ? `${labels.mail}${targetName}`
    : `Email ${cleanEmail}${targetName}`;

  const actionsNode = (
    <div
      className={cn("flex items-center gap-1", actionsClassName)}
      onClick={(e) => e.stopPropagation()}
    >
      {canMail ? (
        <ActionIconButton
          icon={Mail}
          label={mailLabel}
          tooltipText={mailLabel}
          href={onEmail ? undefined : mailHref}
          toneClass={MESSAGING_ICON_BTN_TONES.email}
          onClick={onEmail}
        />
      ) : null}
      {canCopy ? (
        <ActionCopyButton
          text={cleanEmail}
          copyToastMessage={copyToast}
          tooltipCopyText={labels?.copy}
          tooltipCopiedText={labels?.copied}
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
            <Mail
              aria-hidden="true"
              className="w-3.5 h-3.5 text-primary/80 flex-shrink-0 group-hover/pill:text-primary transition-colors"
            />
            <span className="font-semibold tracking-tight truncate select-all">{cleanEmail}</span>
          </div>
          {actionsNode}
        </div>
      </TooltipProvider>
    );
  }

  const valueDisplayNode = (
    <span
      data-cell-truncate
      className={cn(
        "max-w-full truncate text-sm text-muted-foreground font-medium select-all",
        // Stacked cells need a full-width block for `truncate` to have a definite
        // width; the inline (drawer) variant stays a flex child so the actions
        // remain on the same line.
        variant === "inline" ? "min-w-0" : "block w-full",
      )}
      title={cleanEmail}
    >
      {cleanEmail}
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
      <div className={cn("flex min-w-0 flex-col items-start gap-1 group/email", className)}>
        {valueDisplayNode}
        {actionsNode}
      </div>
    </TooltipProvider>
  );
};
