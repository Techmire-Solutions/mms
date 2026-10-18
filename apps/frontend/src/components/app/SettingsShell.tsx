import React from "react";
import type { AppTranslationKey } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { WORK_SURFACE_INNER } from "@/components/ui/formStyles";

export { SettingsColoursBadge } from "@/components/app/SettingsShellBadges";

export const SETTINGS_WIDTH = {
  narrow: "max-w-2xl",
  medium: "max-w-3xl",
  wide: "max-w-4xl",
} as const;

interface SettingsPanelProps {
  width?: keyof typeof SETTINGS_WIDTH;
  /** Translation key for supplementary panel copy (`*Desc` sibling). */
  introKey: AppTranslationKey;
  isDirty?: boolean;
  saved?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * Consistent settings tab shell — intro, status, content, sticky actions.
 */
export function SettingsPanel({
  width = "medium",
  introKey,
  isDirty = false,
  saved = false,
  children,
  footer,
}: SettingsPanelProps): React.JSX.Element {
  const { t } = useTranslation();
  const introDescKey = `${introKey}Desc` as AppTranslationKey;

  return (
    <div className={cn(SETTINGS_WIDTH[width], "space-y-8 pb-2")}>
      <SettingsPanelIntro description={t(introDescKey)} />
      <SettingsStatusBadges isDirty={isDirty} saved={saved} />
      <div className="space-y-8">{children}</div>
      {footer}
    </div>
  );
}

interface SettingsPanelIntroProps {
  description: string;
  className?: string;
}

export function SettingsPanelIntro({
  description,
  className,
}: SettingsPanelIntroProps): React.JSX.Element {
  return (
    <p
      className={cn(
        "rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-xs leading-relaxed text-muted-foreground sm:px-5",
        className,
      )}
    >
      {description}
    </p>
  );
}

export function SettingsStatusBadges({
  isDirty,
  saved,
}: {
  isDirty: boolean;
  saved: boolean;
}): React.JSX.Element | null {
  const { t } = useTranslation();
  if (!isDirty && !saved) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 transition-all",
        isDirty ? "border-warning/30 bg-warning/5" : "border-border/60 bg-muted/20",
      )}
      aria-live="polite"
    >
      {isDirty ? (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-warning">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning" aria-hidden />
          {t("settings.unsavedChanges")}
        </span>
      ) : null}
      {saved && !isDirty ? (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" aria-hidden />
          {t("settings.savedBadge")}
        </span>
      ) : null}
    </div>
  );
}

interface SettingsToggleRowProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function SettingsToggleRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled = false,
}: SettingsToggleRowProps): React.JSX.Element {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-xl border px-3.5 py-3.5 transition-colors",
        checked
          ? "border-primary/20 bg-primary/5"
          : "border-border/60 bg-muted/10 hover:border-border hover:bg-muted/20",
      )}
    >
      <div className="min-w-0 flex-1">
        <Label htmlFor={id} className="text-sm font-semibold text-foreground cursor-pointer">
          {label}
        </Label>
        {description ? (
          <p id={`${id}-desc`} className="mt-0.5 text-xs text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-describedby={description ? `${id}-desc` : undefined}
      />
    </div>
  );
}

export function SettingsFieldGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}): React.JSX.Element {
  return <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2", className)}>{children}</div>;
}

export function SettingsCallout({
  variant = "info",
  children,
}: {
  variant?: "info" | "warning";
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5 text-xs leading-relaxed",
        variant === "warning"
          ? "border-warning/30 bg-warning/10 text-warning dark:border-warning/30 dark:bg-warning/10 dark:text-warning"
          : `${WORK_SURFACE_INNER} text-muted-foreground`,
      )}
    >
      {children}
    </div>
  );
}
