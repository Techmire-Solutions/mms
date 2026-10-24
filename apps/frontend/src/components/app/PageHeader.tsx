import React from "react";

export interface PageHeaderProps {
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }> | null;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  breadcrumb?: string | null;
}

/**
 * PageHeader — unified top section for every page.
 *
 * @param {PageHeaderProps} props - The component props.
 * @returns {React.ReactElement} The rendered PageHeader component.
 */
export const PageHeader = function PageHeader({
  icon: Icon = null,
  title,
  subtitle = "",
  actions = null,
  breadcrumb = null,
}: PageHeaderProps): React.ReactElement {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Icon className="h-4.5 w-4.5 text-primary" aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0">
          {breadcrumb && (
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
              {breadcrumb}
            </p>
          )}
          <h1 className="text-xl font-bold text-foreground leading-tight break-words text-balance">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-0.5 break-words text-pretty">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
};
