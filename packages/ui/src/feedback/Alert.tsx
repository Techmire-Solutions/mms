import React from "react";
import type { LucideIcon } from "lucide-react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../utils";

export type AlertDensity = "compact" | "banner";
export type AlertTone = "warning" | "info" | "destructive" | "success";

const DEFAULT_TONE_ICONS: Record<AlertTone, LucideIcon> = {
  warning: AlertTriangle,
  info: Info,
  destructive: AlertCircle,
  success: CheckCircle2,
};

const TONE_CLASSES: Record<
  AlertTone,
  { shell: string; icon: string; descriptionWithTitle: string; bannerText: string }
> = {
  warning: {
    shell: "border-warning/30 bg-warning/10",
    icon: "text-warning",
    descriptionWithTitle: "text-warning/90",
    bannerText: "text-warning",
  },
  info: {
    shell: "border-info/30 bg-info/10",
    icon: "text-info",
    descriptionWithTitle: "text-info/90",
    bannerText: "text-info",
  },
  destructive: {
    shell: "border-destructive/30 bg-destructive/10",
    icon: "text-destructive",
    descriptionWithTitle: "text-destructive/90",
    bannerText: "text-destructive",
  },
  success: {
    shell: "border-success/30 bg-success/10",
    icon: "text-success",
    descriptionWithTitle: "text-success/90",
    bannerText: "text-success",
  },
};

export interface AlertProps {
  icon?: LucideIcon;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  role?: "status" | "alert";
  density?: AlertDensity;
  /** Visual tone — defaults to warning (amber). */
  tone?: AlertTone;
  className?: string;
}

export function Alert({
  icon,
  title,
  description,
  children,
  action,
  role = "status",
  density = "banner",
  tone = "warning",
  className,
}: AlertProps): React.JSX.Element {
  const isCompact = density === "compact";
  const tones = TONE_CLASSES[tone];
  const Icon = icon ?? DEFAULT_TONE_ICONS[tone];

  return (
    <div
      role={role}
      className={cn(
        "flex gap-2 rounded-xl border",
        tones.shell,
        isCompact
          ? "items-start px-3 py-2.5 text-xs font-medium text-foreground"
          : cn("items-center px-4 py-3 text-sm", tones.bannerText),
        action ? "justify-between" : undefined,
        className,
      )}
    >
      <div className={cn("flex min-w-0 gap-2", isCompact ? "items-start" : "items-center")}>
        <Icon
          className={cn("shrink-0", tones.icon, isCompact ? "mt-0.5 h-3.5 w-3.5" : "h-4 w-4")}
          aria-hidden="true"
        />
        <div className="min-w-0">
          {title ? <p className="m-0 font-semibold">{title}</p> : null}
          {description ? (
            <p className={cn("m-0", title ? tones.descriptionWithTitle : undefined)}>
              {description}
            </p>
          ) : null}
          {children}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

