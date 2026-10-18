import React, { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "./Button";
import { cn } from "../utils";

export interface CopyButtonProps {
  text: string;
  className?: string;
  variant?: "ghost" | "outline" | "default";
  /** When set, render a visible labeled button (icon + this text) instead of icon-only. */
  label?: string;
  /** Copied-state label shown when `label` is provided. */
  labelCopied?: string;
  /** Tooltip/aria title when idle. */
  title?: string;
  /** Tooltip/aria title when copied. */
  titleCopied?: string;
  /** Optional callback fired when copy succeeds. */
  onCopy?: () => void;
}

export type CopyBtnProps = CopyButtonProps;

const DEFAULT_ICON_BTN_CLASS =
  "min-h-11 min-w-11 rounded-xl border border-muted-foreground/30 bg-muted-foreground/5 text-muted-foreground hover:text-foreground hover:bg-muted-foreground/15 hover:border-muted-foreground/40 shadow-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 touch-manipulation cursor-pointer";

/**
 * Reusable copy-to-clipboard control with feedback icon.
 * Icon-only by default; pass `label`/`labelCopied` for a visible
 * labeled action button (e.g. "Copy JSON" / "Copied").
 */
export function CopyButton({
  text,
  className,
  variant,
  label,
  labelCopied,
  title = "Copy to clipboard",
  titleCopied = "Copied",
  onCopy,
}: CopyButtonProps): React.JSX.Element {
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = (e: React.MouseEvent<HTMLButtonElement>): void => {
    e.stopPropagation();
    if (!text) return;
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        onCopy?.();
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => undefined);
  };

  // Labeled variant: a visible action button with text feedback.
  if (label) {
    return (
      <Button
        type="button"
        data-copy={text}
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
      data-copy={text}
      onClick={handleCopy}
      variant={variant}
      title={copied ? titleCopied : title}
      aria-label={copied ? titleCopied : title}
      className={cn(
        DEFAULT_ICON_BTN_CLASS,
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
