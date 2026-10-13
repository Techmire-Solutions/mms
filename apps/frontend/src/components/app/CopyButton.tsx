import React, { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import {
  MESSAGING_ICON_BTN,
  MESSAGING_ICON_BTN_TONES,
} from "@/components/ui/messagingActionStyles";
import { cn } from "@/lib/utils";

export interface CopyButtonProps {
  text: string;
  className?: string;
  variant?: "ghost" | "outline" | "default";
  showToast?: boolean;
  /** When set, render a visible labeled button (icon + this text) instead of icon-only. */
  label?: string;
  /** Copied-state label shown when `label` is provided. */
  labelCopied?: string;
}

export type CopyBtnProps = CopyButtonProps;

/**
 * Reusable copy-to-clipboard control with feedback icon + optional toast.
 * Icon-only by default (hover-reveal); pass `label`/`labelCopied` for a visible
 * labeled action button (e.g. "Copy JSON" / "Copied").
 */
export function CopyButton({
  text,
  className,
  variant,
  showToast = false,
  label,
  labelCopied,
}: CopyButtonProps): React.JSX.Element {
  const { t } = useTranslation();
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = (e: React.MouseEvent<HTMLButtonElement>): void => {
    e.stopPropagation();
    if (!text) return;
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        if (showToast) {
          notify.success(t("contacts.table.copied"));
        }
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => undefined);
  };

  // Labeled variant: a visible action button with text feedback.
  if (label) {
    return (
      <Button
        type="button"
        size="sm"
        variant={variant ?? "outline"}
        onClick={handleCopy}
        aria-label={copied ? (labelCopied ?? label) : label}
        className={cn("gap-1.5 text-xs font-semibold rounded-xl cursor-pointer", className)}
      >
        {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? (labelCopied ?? label) : label}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      onClick={handleCopy}
      variant={variant}
      title={copied ? t("contacts.table.copied") : t("contacts.table.copy")}
      aria-label={copied ? t("contacts.table.copied") : t("contacts.table.copy")}
      className={cn(
        MESSAGING_ICON_BTN,
        MESSAGING_ICON_BTN_TONES.copy,
        "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity",
        className,
      )}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
    </Button>
  );
}

/** Backward-compatibility alias */
export const CopyBtn = CopyButton;
