import React from "react";
import { Loader2, PlugZap, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldErrorMessage } from "@/components/app/FormField";
import { SettingsCallout } from "@/components/app/SettingsShell";
import { Badge } from "@/components/ui/badge";
import { WORK_SURFACE_INNER } from "@/components/ui/formStyles";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface PlatformIntegrationPanelChromeProps {
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

/** Shared chrome (loading state, header, callout, field grid, actions) for platform email/SMS integration panels. */
export function PlatformIntegrationPanelChrome({
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
}: PlatformIntegrationPanelChromeProps): React.JSX.Element {
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
      </div>
    );
  }

  return (
    <div className={cn(WORK_SURFACE_INNER, "space-y-4 p-4")}>
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
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

      <SettingsCallout variant="info">{calloutText}</SettingsCallout>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>

      {lastError && !lastTestOk ? <FieldErrorMessage message={lastError} /> : null}

      {footerContent}

      <div className="flex flex-wrap gap-2.5 pt-1">
        <Button
          type="button"
          onClick={onSave}
          disabled={saving || testing}
          className="min-h-11 gap-2 px-4 shadow-sm"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <PlugZap className="h-4 w-4" aria-hidden />
          )}
          <span>{saveLabel}</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onTest}
          disabled={saving || testing || testDisabled}
          className="min-h-11 gap-2 px-4"
        >
          {testing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          <span>{testLabel}</span>
        </Button>
      </div>
    </div>
  );
}
