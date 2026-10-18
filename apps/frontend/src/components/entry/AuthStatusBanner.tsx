import React from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type AuthBannerVariant = "error" | "info" | "warning" | "loading";

export function AuthStatusBanner({
  message,
  variant = "error",
}: {
  message: React.ReactNode;
  variant?: AuthBannerVariant;
}): React.JSX.Element {
  const isLoading = variant === "loading";
  const isInfo = variant === "info";
  const isWarning = variant === "warning";
  const isPolite = isLoading || isInfo || isWarning;

  return (
    <div
      role={isPolite ? "status" : "alert"}
      aria-live={isPolite ? "polite" : "assertive"}
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm",
        (isLoading || isInfo) && "border-primary/25 bg-primary/5 text-foreground",
        isWarning && "border-warning/30 bg-warning/5 text-foreground",
        !isPolite && "border-destructive/40 bg-destructive/5 text-destructive",
      )}
    >
      {isLoading ? (
        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />
      ) : isInfo ? (
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
      ) : isWarning ? (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
      ) : (
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      )}
      <div className="min-w-0 flex-1 leading-snug">{message}</div>
    </div>
  );
}

export function AuthFormHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}): React.JSX.Element {
  return (
    <div className="space-y-1.5">
      <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{title}</h1>
      {subtitle ? (
        <p className="text-sm font-medium leading-relaxed text-muted-foreground">{subtitle}</p>
      ) : null}
    </div>
  );
}

export function AuthHeroIcon({
  icon: Icon,
  tone = "primary",
}: {
  icon: LucideIcon;
  tone?: "primary" | "destructive";
}): React.JSX.Element {
  return (
    <div
      className={cn(
        "mx-auto flex h-14 w-14 items-center justify-center rounded-2xl",
        tone === "destructive" ? "bg-destructive/10" : "bg-primary/10",
      )}
      aria-hidden
    >
      <Icon
        className={cn("h-7 w-7", tone === "destructive" ? "text-destructive" : "text-primary")}
      />
    </div>
  );
}

export function AuthMutedPanel({
  children,
  className,
  align = "start",
}: {
  children: React.ReactNode;
  className?: string;
  align?: "start" | "center";
}): React.JSX.Element {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-muted/40 px-4 py-3 text-sm",
        align === "center" ? "text-center" : "text-start",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AuthStatusHeader({
  icon: Icon,
  title,
  description,
  tone = "primary",
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  tone?: "primary" | "destructive";
}): React.JSX.Element {
  return (
    <div className="space-y-4">
      <AuthHeroIcon icon={Icon} tone={tone} />
      <AuthFormHeading title={title} subtitle={description} />
    </div>
  );
}

export function AuthCheckEmailSuccess({
  children,
  secondaryLabel,
  onSecondary,
  footer,
}: {
  children?: React.ReactNode;
  secondaryLabel: string;
  onSecondary: () => void;
  footer?: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="space-y-5">
      <div className="flex justify-center">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"
          aria-hidden
        >
          <CheckCircle2 className="h-8 w-8 text-primary" />
        </div>
      </div>
      {children}
      <Button
        type="button"
        variant="outline"
        onClick={onSecondary}
        className="h-11 w-full rounded-xl"
      >
        {secondaryLabel}
      </Button>
      {footer}
    </div>
  );
}
