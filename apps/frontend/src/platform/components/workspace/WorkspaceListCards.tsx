import type { WorkspaceTableViewProps } from "./WorkspaceTableView";
import React from "react";
import { Calendar } from "lucide-react";
import { formatDate, type PlatformWorkspaceRow as PlatformWorkspaceRowData } from "@mms/shared";
import { tenantUrl } from "@/lib/config/tenantConfig";
import { useTranslation } from "@/hooks/useTranslation";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { ModuleDirectoryCards } from "@/components/app/ModuleDirectoryCards";
import { DirectoryEntityCard } from "@/components/app/DirectoryEntityCard";
import { DirectoryCardMetadata } from "@/components/app/DirectoryCardMetadata";
import { WorkspaceIdentityCell } from "@/platform/components/workspace/WorkspaceIdentityCell";
import { WorkspaceStatusBadge } from "@/platform/components/workspace/WorkspaceStatusBadge";
import { WorkspaceRowActions } from "@/platform/components/workspace/WorkspaceRowActions";
import { Checkbox } from "@shared/ui";
import { cn } from "@/lib/utils";
import type { EntityDescriptor } from "@/components/common/entityRegistryTypes";

export type WorkspaceListCardsProps = Omit<
  WorkspaceTableViewProps,
  | "descriptor"
  | "columnLayout"
  | "density"
  | "sortField"
  | "sortDirection"
  | "onToggleSort"
  | "onToggleSelectAll"
> & { descriptor?: EntityDescriptor<PlatformWorkspaceRowData> };

/** Directory list cards view for platform workspaces, aligning with tenant [Entity]ListCards. */
export function WorkspaceListCards({
  workspaces,
  descriptor,
  appDomain,
  togglePending,
  deletePending,
  targetWorkspaceSubdomain,
  onToggleEnabled,
  onToggleEmailVerification,
  onOpenModules,
  onOpenDelete,
  onOpenResetPassword,
  onOpenCreateAdmin,
  onInspect,
  selectedSubdomains,
  onToggleSelect,
}: WorkspaceListCardsProps): React.JSX.Element {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();

  return (
    <ModuleDirectoryCards>
      {workspaces.map((workspace) => {
        const isTargetDelete = deletePending && targetWorkspaceSubdomain === workspace.subdomain;
        return (
          <DirectoryEntityCard
            key={workspace.subdomain}
            entity={{ id: workspace.subdomain, ...workspace }}
            reducedMotion={reducedMotion}
            accentClassName={!workspace.enabled ? "bg-muted-foreground/50" : "bg-primary/80"}
            onView={onInspect ? () => onInspect(workspace) : undefined}
            onCardClick={onInspect ? () => onInspect(workspace) : undefined}
            className={cn(
              "flex flex-col justify-between transition-all",
              onInspect && "cursor-pointer",
              !workspace.enabled && "opacity-85 hover:opacity-100",
              isTargetDelete && "opacity-40 pointer-events-none",
            )}
            headerSlot={
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  {onToggleSelect && selectedSubdomains && (
                    <div
                      className="mt-1 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={selectedSubdomains.has(workspace.subdomain)}
                        onCheckedChange={() => onToggleSelect(workspace.subdomain)}
                        aria-label={t("platform.workspaces.selectItem", {
                          name: workspace.madrasaName,
                        })}
                      />
                    </div>
                  )}
                  <WorkspaceIdentityCell workspace={workspace} appDomain={appDomain} />
                </div>
                <WorkspaceStatusBadge enabled={workspace.enabled} />
              </div>
            }
            metadataSlot={
              descriptor ? (
                <DirectoryCardMetadata
                  descriptor={descriptor}
                  entity={workspace}
                  visibleColumnIds={["createdAt"]}
                />
              ) : workspace.createdAt ? (
                <div className="flex items-center gap-1.5 text-2xs font-semibold text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5 shrink-0 opacity-75" aria-hidden />
                  <span>
                    {t("platform.sort.createdAt")}: {formatDate(workspace.createdAt)}
                  </span>
                </div>
              ) : null
            }
            footer={
              <div
                className="mt-4 w-full"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <WorkspaceRowActions
                  subdomain={workspace.subdomain}
                  enabled={workspace.enabled}
                  requireEmailVerification={workspace.requireEmailVerification}
                  busy={togglePending || deletePending}
                  deletePending={isTargetDelete}
                  tenantLink={tenantUrl(workspace.subdomain, "/")}
                  onToggle={(enabled) => onToggleEnabled(workspace.subdomain, enabled)}
                  onToggleEmailVerification={(req) =>
                    onToggleEmailVerification(workspace.subdomain, req)
                  }
                  onOpenModules={() => onOpenModules(workspace)}
                  onOpenDelete={onOpenDelete ? () => onOpenDelete(workspace) : undefined}
                  onOpenResetPassword={
                    onOpenResetPassword ? () => onOpenResetPassword(workspace) : undefined
                  }
                  onOpenCreateAdmin={
                    onOpenCreateAdmin ? () => onOpenCreateAdmin(workspace) : undefined
                  }
                />
              </div>
            }
          />
        );
      })}
    </ModuleDirectoryCards>
  );
}
