import React from "react";
import { MoreHorizontal, Eye, ExternalLink } from "lucide-react";
import type { PlatformWorkspaceRow } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { usePlatformInspector } from "@/platform/lib/PlatformInspectorContext";
import { Button } from "@shared/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@shared/ui";
import { tenantUrl } from "@/lib/config/tenantConfig";

interface PlatformDashboardFleetRowMenuProps {
  row: PlatformWorkspaceRow;
}

export function PlatformDashboardFleetRowMenu({
  row,
}: PlatformDashboardFleetRowMenuProps): React.JSX.Element {
  const { t } = useTranslation();
  const { openInspector } = usePlatformInspector();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          icon={MoreHorizontal}
          className="min-w-11"
          aria-label={t("common.actions")}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 rounded-xl">
        <DropdownMenuItem
          className="cursor-pointer text-xs font-semibold gap-2"
          onSelect={() =>
            openInspector({
              kind: "workspace",
              subdomain: row.subdomain,
              madrasaName: row.madrasaName,
              enabled: row.enabled,
              createdAt: row.createdAt,
              adminEmail: row.adminEmail,
            })
          }
        >
          <Eye className="h-3.5 w-3.5" aria-hidden />
          {t("platform.inspectWorkspace")}
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer text-xs font-semibold gap-2">
          <a href={tenantUrl(row.subdomain, "/")} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            {t("platform.openWorkspace")}
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
