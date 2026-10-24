import React from "react";
import { Loader2, PlugZap, type LucideIcon } from "lucide-react";
import { Button } from "../button/Button";
import { Badge } from "../button/Badge";
import { Skeleton } from "../feedback/Skeleton";
import { FieldErrorMessage } from "../input/FormField";
import { WORK_SURFACE_INNER } from "../theme/formStyles";
import { cn } from "../utils";

export interface IntegrationPanelChromeProps {
  icon: LucideIcon;
  title: string;
  description: string;
  calloutText: string;
  connected: boolean;
  lastTestOk: boolean | undefined;
  statusConnectedText: string;
  statusNotConnectedText: string;
  loading: boolean;
  lastError: string | null | undefined;
  saving: boolean;
  testing: boolean;
  testDisabled?: boolean;
  saveLabel: string;
  testLabel: string;
  onSave: () => void;
  onTest: () => void;
  children: React.ReactNode;
  footerContent?: React.ReactNode;
}

/**
 * Shared integration panel chrome (loading skeleton, header with status badge, callout,
 * field grid, error messaging, and standard save/test action buttons).
 *
 * Used across email and SMS configuration panels in both Tenant and Platform consoles.
 */
export function IntegrationPanelChrome({
  icon: Icon,
  title,
  description,
  calloutText,
  connected,
  lastTestOk,
  statusConnectedText,
  statusNotConnectedText,
  loading,
  lastError,
  saving,
  testing,
  testDisabled,
  saveLabel,
  testLabel,
  onSave,
  onTest,
  children,
  footerContent,
}: IntegrationPanelChromeProps): React.JSX.Element {
  if (loading) {
    return (
      <div className={cn(WORK_SURFACE_INNER, "space-y-4 p-4")} aria-busy="true">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-10 w-full rounded-lg" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Skeleton className="h-10 w-full rounded-lg sm:col-span-2" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn(WORK_SURFACE_INNER, "space-y-4 p-4")}>
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground text-balance">{title}</p>
          <p className="text-xs text-muted-foreground text-pretty">{description}</p>
        </div>
        {connected && lastTestOk ? (
          <Badge as="span" tone="success" size="sm">
            {statusConnectedText}
          </Badge>
        ) : (
          <Badge as="span" tone="muted" size="sm">
            {statusNotConnectedText}
          </Badge>
        )}
      </div>

      <div
        className={cn(
          "rounded-lg border px-3 py-2.5 text-xs leading-relaxed text-pretty",
          WORK_SURFACE_INNER,
          "text-muted-foreground",
        )}
      >
        {calloutText}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>

      {lastError && !lastTestOk ? <FieldErrorMessage message={lastError} /> : null}

      {footerContent}

      <div className="flex flex-col-reverse sm:flex-row flex-wrap gap-2.5 pt-1">
        <Button
          type="button"
          onClick={onSave}
          disabled={saving || testing}
          className="min-h-11 gap-2 px-4 shadow-sm cursor-pointer"
        >
          {saving ? (
            <Loader2
              className="h-4 w-4 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : (
            <PlugZap className="h-4 w-4" aria-hidden="true" />
          )}
          <span>{saveLabel}</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onTest}
          disabled={saving || testing || testDisabled}
          className="min-h-11 gap-2 px-4 cursor-pointer"
        >
          {testing ? (
            <Loader2
              className="h-4 w-4 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : null}
          <span>{testLabel}</span>
        </Button>
      </div>
    </div>
  );
}
