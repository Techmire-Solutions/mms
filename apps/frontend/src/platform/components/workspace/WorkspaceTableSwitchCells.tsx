import React from "react";
import type { PlatformWorkspaceRow as PlatformWorkspaceRowData } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { WorkspaceStatusBadge } from "@/platform/components/workspace/WorkspaceStatusBadge";

export interface WorkspaceTableSwitchCellsProps {
  workspace: PlatformWorkspaceRowData;
  busy: boolean;
  onToggleEnabled: (subdomain: string, enabled: boolean) => void;
  onToggleEmailVerification: (subdomain: string, required: boolean) => void;
}

/** Stop nested switch clicks from triggering row inspect. */
function StopRowClick({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div
      className="flex items-center gap-2.5"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

export function WorkspaceEnabledCell({
  workspace,
  busy,
  onToggleEnabled,
}: Pick<
  WorkspaceTableSwitchCellsProps,
  "workspace" | "busy" | "onToggleEnabled"
>): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <StopRowClick>
      <Switch
        id={`table-toggle-${workspace.subdomain}`}
        checked={workspace.enabled}
        disabled={busy}
        onCheckedChange={(checked) => onToggleEnabled(workspace.subdomain, checked)}
        aria-label={t("platform.workspaceActive")}
      />
      <WorkspaceStatusBadge enabled={workspace.enabled} />
    </StopRowClick>
  );
}

export function WorkspaceEmailVerificationCell({
  workspace,
  busy,
  onToggleEmailVerification,
}: Pick<
  WorkspaceTableSwitchCellsProps,
  "workspace" | "busy" | "onToggleEmailVerification"
>): React.JSX.Element {
  const { t } = useTranslation();
  const required = Boolean(workspace.requireEmailVerification);
  return (
    <StopRowClick>
      <Switch
        id={`table-verify-${workspace.subdomain}`}
        checked={required}
        disabled={busy}
        onCheckedChange={(checked) => onToggleEmailVerification(workspace.subdomain, checked)}
        aria-label={t("platform.emailVerification")}
      />
      <Label
        htmlFor={`table-verify-${workspace.subdomain}`}
        className="text-xs font-semibold text-muted-foreground whitespace-nowrap cursor-pointer select-none"
      >
        {required
          ? t("platform.emailVerificationRequired")
          : t("platform.emailVerificationOptional")}
      </Label>
    </StopRowClick>
  );
}
