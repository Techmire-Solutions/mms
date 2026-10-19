import React, { useState } from "react";
import { Copy, Check, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  MESSAGING_ICON_BTN,
  MESSAGING_ICON_BTN_TONES,
} from "@/components/app/messagingActionStyles";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/notify";
import { useTranslation } from "@/hooks/useTranslation";

export type ContactActionVariant = "stacked" | "inline" | "pill" | "actions-only" | "drawer";

interface ActionIconButtonProps {
  icon: LucideIcon;
  label: string;
  tooltipText: string;
  href?: string | null;
  target?: string;
  rel?: string;
  toneClass?: string;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export const ActionIconButton = function ActionIconButton({
  icon: Icon,
  label,
  tooltipText,
  href,
  target,
  rel,
  toneClass,
  className,
  onClick,
}: ActionIconButtonProps): React.JSX.Element {
  const commonClasses = cn(
    MESSAGING_ICON_BTN,
    "relative h-7 w-7 min-h-7 min-w-7 sm:min-h-7 sm:min-w-7 rounded-lg inline-flex items-center justify-center p-0 shrink-0 select-none text-xs before:absolute before:-inset-2 before:content-['']",
    toneClass,
    className,
  );

  const content = (
    <>
      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      <span className="sr-only">{label}</span>
    </>
  );

  const element = href ? (
    <Button
      asChild
      variant="ghost"
      className={commonClasses}
      onClick={(e) => {
        e.stopPropagation();
        if (onClick) {
          e.preventDefault();
          onClick(e);
        }
      }}
    >
      <a href={href} target={target} rel={rel} aria-label={label}>
        {content}
      </a>
    </Button>
  ) : (
    <Button
      type="button"
      variant="ghost"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      className={commonClasses}
    >
      {content}
    </Button>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{element}</TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={4} className="text-xs">
        {tooltipText}
      </TooltipContent>
    </Tooltip>
  );
};

interface ActionCopyButtonProps {
  text: string;
  copyToastMessage?: string;
  tooltipCopyText?: string;
  tooltipCopiedText?: string;
  className?: string;
}

export const ActionCopyButton = function ActionCopyButton({
  text,
  copyToastMessage,
  tooltipCopyText,
  tooltipCopiedText,
  className,
}: ActionCopyButtonProps): React.JSX.Element {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent): void => {
    e.stopPropagation();
    if (!text) return;
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        if (copyToastMessage) {
          notify.success(copyToastMessage);
        }
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => undefined);
  };

  const translatedCopy = t("common.copy");
  const translatedCopied = t("common.copied");
  const defaultCopy = translatedCopy === "common.copy" ? "Copy" : translatedCopy;
  const defaultCopied = translatedCopied === "common.copied" ? "Copied" : translatedCopied;

  const label = copied ? (tooltipCopiedText ?? defaultCopied) : (tooltipCopyText ?? defaultCopy);

  return (
    <ActionIconButton
      icon={copied ? Check : Copy}
      label={label}
      tooltipText={label}
      toneClass={cn(
        MESSAGING_ICON_BTN_TONES.copy,
        copied &&
          "border-success/30 bg-success/5 text-success hover:text-success hover:bg-success/15 hover:border-success/40",
      )}
      onClick={handleCopy}
      className={className}
    />
  );
};
