import React from "react";
import { StatusBadge } from "@shared/ui";
import { SEMANTIC_BADGE } from "@/lib/ui/semanticTone";
import { useTranslation } from "@/hooks/useTranslation";

interface WorkspaceStatusBadgeProps {
  enabled: boolean;
}

export function WorkspaceStatusBadge({ enabled }: WorkspaceStatusBadgeProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <StatusBadge
      status={enabled ? "active" : "disabled"}
      config={{
        active: { label: t("platform.workspaceActive"), cls: SEMANTIC_BADGE.success },
        disabled: { label: t("platform.workspaceInactive"), cls: SEMANTIC_BADGE.muted },
      }}
      size="sm"
    />
  );
}
