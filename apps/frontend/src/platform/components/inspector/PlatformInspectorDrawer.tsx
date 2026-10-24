import React, { useEffect } from "react";
import { Building2, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import { usePlatformInspector } from "@/platform/lib/PlatformInspectorContext";
import { usePlatformBreadcrumb } from "@/platform/lib/PlatformBreadcrumbContext";
import { Drawer } from "@/components/app/Drawer";
import { Button } from "@shared/ui";
import { WorkspaceStatusBadge } from "@/platform/components/workspace/WorkspaceStatusBadge";
import { ROUTES } from "@/lib/config/routes";
import { tenantUrl } from "@/lib/config/tenantConfig";
import { formatDate } from "@mms/shared";

/** Right-side contextual inspector — independent of the system AI drawer. */
export function PlatformInspectorDrawer(): React.JSX.Element | null {
  const { t } = useTranslation();
  const { target, closeInspector } = usePlatformInspector();
  const { setExtraSegments, clearExtraSegments } = usePlatformBreadcrumb();

  useEffect(() => {
    if (!target) {
      clearExtraSegments();
      return;
    }
    setExtraSegments([{ label: target.madrasaName }]);
    return () => clearExtraSegments();
  }, [target, setExtraSegments, clearExtraSegments]);

  if (!target) return null;

  const directoryHref = `${ROUTES.platformWorkspaces}?q=${encodeURIComponent(target.subdomain)}`;
  const openHref = tenantUrl(target.subdomain, "/");

  return (
    <Drawer
      open
      onClose={closeInspector}
      side="end"
      size="md"
      icon={Building2}
      title={target.madrasaName}
      subtitle={target.subdomain}
      badge={<WorkspaceStatusBadge enabled={target.enabled} />}
      ariaLabel={t("platform.inspectorTitle")}
      footer={
        <div className="flex flex-col-reverse sm:flex-row flex-wrap gap-2 justify-end w-full sm:w-auto">
          <Button asChild variant="outline" className="min-h-11 rounded-xl cursor-pointer">
            <Link to={directoryHref}>{t("platform.viewInDirectory")}</Link>
          </Button>
          <Button asChild className="min-h-11 rounded-xl cursor-pointer">
            <a href={openHref} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 me-1.5" aria-hidden="true" />
              {t("platform.openWorkspace")}
            </a>
          </Button>
        </div>
      }
    >
      <dl className="space-y-4 text-sm">
        <div>
          <dt className="text-3xs font-bold uppercase tracking-wide text-muted-foreground">
            {t("platform.workspaceActive")}
          </dt>
          <dd className="mt-1">
            <WorkspaceStatusBadge enabled={target.enabled} />
          </dd>
        </div>
        {target.createdAt ? (
          <div>
            <dt className="text-3xs font-bold uppercase tracking-wide text-muted-foreground">
              {t("platform.sort.createdAt")}
            </dt>
            <dd className="mt-1 font-semibold tabular-nums text-foreground">
              {formatDate(target.createdAt)}
            </dd>
          </div>
        ) : null}
        {target.adminEmail ? (
          <div>
            <dt className="text-3xs font-bold uppercase tracking-wide text-muted-foreground">
              {t("platform.adminEmail")}
            </dt>
            <dd className="mt-1 font-semibold text-foreground break-all">{target.adminEmail}</dd>
          </div>
        ) : null}
      </dl>
    </Drawer>
  );
}
