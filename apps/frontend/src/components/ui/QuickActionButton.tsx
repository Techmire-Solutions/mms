import React, { type JSX } from "react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface QuickActionButtonProps {
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

export const QuickActionButton = function QuickActionButton({
  label,
  icon: Icon,
  onClick,
  href,
  disabled = false,
  className = "",
  ariaLabel,
}: QuickActionButtonProps): JSX.Element {
  const baseClasses = `flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border transition-all ${className}`;
  if (href && !disabled) {
    return (
      <a href={href} aria-label={ariaLabel || label} className={baseClasses}>
        <Icon className="w-5 h-5" />
        <span className="text-xs font-bold">{label}</span>
      </a>
    );
  }

  return (
    <Button
      variant="outline"
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel || label}
      className={`h-auto font-normal shadow-none ${baseClasses}`}
      type="button"
    >
      <Icon className="w-5 h-5" />
      <span className="text-xs font-bold">{label}</span>
    </Button>
  );
};
