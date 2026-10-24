import React from "react";
import { cn } from "../utils";
import { CARD_STRIPE_INSET } from "./Card";

export interface CardTitleBarProps {
  title?: React.ReactNode;
  icon?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Trailing action cluster rendered at the end of the strip. */
  actions?: React.ReactNode;
  headingLevel?: 2 | 3;
  headingId?: string;
  /** Left inset for accent-striped cards. */
  inset?: boolean;
  className?: string;
}

/** Card title-bar strip — SSOT for the tinted icon/title/actions header row flush inside a Card. */
export function CardTitleBar({
  title,
  icon,
  subtitle,
  actions,
  headingLevel = 3,
  headingId,
  inset = false,
  className,
}: CardTitleBarProps): React.JSX.Element {
  const HeadingTag = headingLevel === 2 ? "h2" : "h3";
  return (
    <div
      className={cn(
        "flex min-w-0 items-center justify-between gap-2 border-b border-border/40 bg-muted/20 px-5 py-3.5",
        inset && CARD_STRIPE_INSET,
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && (
          <span className="shrink-0" aria-hidden="true">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          {title && (
            <HeadingTag
              id={headingId}
              className="m-0 min-w-0 truncate text-sm font-bold text-foreground"
            >
              {title}
            </HeadingTag>
          )}
          {subtitle && <p className="m-0 truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

CardTitleBar.displayName = "CardTitleBar";
