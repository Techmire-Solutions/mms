import React from "react";
import { Blocks, ExternalLink, KeyRound, Trash2, UserPlus } from "lucide-react";
import { Button } from "@shared/ui";
import { Switch } from "@shared/ui";
import { Label } from "@shared/ui";
import { useTranslation } from "@/hooks/useTranslation";

interface WorkspaceRowActionsProps {
  subdomain: string;
  enabled: boolean;
  requireEmailVerification?: boolean;
  busy: boolean;
  deletePending: boolean;
  tenantLink: string;
  variant?: "table" | "card";
  onToggle: (enabled: boolean) => void;
  onToggleEmailVerification?: (requireEmailVerification: boolean) => void;
  onOpenModules: () => void;
  onOpenDelete?: () => void;
  onOpenResetPassword?: () => void;
  onOpenCreateAdmin?: () => void;
}

export function WorkspaceRowActions({
  subdomain,
  enabled,
  requireEmailVerification,
  busy,
  deletePending,
  tenantLink,
  variant = "card",
  onToggle,
  onToggleEmailVerification,
  onOpenModules,
  onOpenDelete,
  onOpenResetPassword,
  onOpenCreateAdmin,
}: WorkspaceRowActionsProps): React.JSX.Element {
  const { t } = useTranslation();

  const actionButtons = (
    <div className="flex items-center gap-2 justify-end">
      <Button
        asChild
        variant="outline"
        size="sm"
        className="min-h-11 px-3.5 text-xs font-bold gap-1.5 rounded-xl shadow-2xs hover:bg-primary/10 hover:text-primary hover:border-primary/40 transition-all cursor-pointer"
      >
        <a
          href={tenantLink}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${t("platform.openWorkspace")} ${subdomain}`}
        >
          <ExternalLink className="w-3.5 h-3.5" aria-hidden />
          {t("platform.openWorkspace")}
        </a>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={onOpenModules}
        icon={Blocks}
        className="min-w-11 text-muted-foreground hover:text-primary hover:bg-primary/10"
        title={`${t("platform.modulesTitle")} (${subdomain})`}
        aria-label={`${t("platform.modulesTitle")} (${subdomain})`}
      />

      {onOpenCreateAdmin ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={onOpenCreateAdmin}
          icon={UserPlus}
          className="min-w-11 text-muted-foreground hover:text-success hover:bg-success/10"
          title={t("platform.tooltipCreateAdmin", { subdomain })}
          aria-label={t("platform.tooltipCreateAdmin", { subdomain })}
        />
      ) : null}

      {onOpenResetPassword ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={onOpenResetPassword}
          icon={KeyRound}
          className="min-w-11 text-muted-foreground hover:text-warning hover:bg-warning/10"
          title={t("platform.tooltipResetPassword", { subdomain })}
          aria-label={t("platform.tooltipResetPassword", { subdomain })}
        />
      ) : null}

      {onOpenDelete ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={busy || deletePending}
          onClick={onOpenDelete}
          icon={Trash2}
          className="min-w-11 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          title={`${t("platform.deleteWorkspace")} (${subdomain})`}
          aria-label={`${t("platform.deleteWorkspace")} (${subdomain})`}
        />
      ) : null}
    </div>
  );

  if (variant === "table") {
    return actionButtons;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/40">
      <div className="flex flex-wrap items-center gap-4 sm:gap-6 min-h-11">
        <div className="flex items-center gap-2.5">
          <Switch
            id={`toggle-${subdomain}`}
            checked={enabled}
            disabled={busy}
            onCheckedChange={onToggle}
            aria-label={t("platform.workspaceActive")}
            className="scale-100"
          />
          <Label
            htmlFor={`toggle-${subdomain}`}
            className="text-xs font-bold text-muted-foreground cursor-pointer select-none"
          >
            {enabled ? t("platform.workspaceActive") : t("platform.workspaceInactive")}
          </Label>
        </div>

        {onToggleEmailVerification && (
          <div className="flex items-center gap-2.5">
            <Switch
              id={`toggle-verify-${subdomain}`}
              checked={Boolean(requireEmailVerification)}
              disabled={busy}
              onCheckedChange={onToggleEmailVerification}
              aria-label={t("platform.emailVerification")}
              className="scale-100"
            />
            <Label
              htmlFor={`toggle-verify-${subdomain}`}
              className="text-xs font-bold text-muted-foreground cursor-pointer select-none"
            >
              {requireEmailVerification
                ? t("platform.emailVerificationRequired")
                : t("platform.emailVerificationOptional")}
            </Label>
          </div>
        )}
      </div>

      <div className="w-full sm:w-auto">{actionButtons}</div>
    </div>
  );
}
