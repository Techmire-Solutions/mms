import React from "react";
import { Plus, Pencil } from "lucide-react";
import { workspaceRoleDescription, workspaceRoleLabel, type WorkspaceRole } from "@mms/shared";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { UserRoleBadge } from "@/tenant/features/users/components/UserBadges";

import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { Badge } from "@/components/ui/badge";

export interface RolesListSidebarProps {
  roles: WorkspaceRole[];
  displayRole: WorkspaceRole | null;
  isAdmin: boolean;
  requestSelectRole: (role: WorkspaceRole) => void;
  requestEditRole: (role: WorkspaceRole | "new") => void;
  t: TranslationFunction;
}

export function RolesListSidebar({
  roles,
  displayRole,
  isAdmin,
  requestSelectRole,
  requestEditRole,
  t,
}: RolesListSidebarProps): React.JSX.Element {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-foreground">{t("users.permissions.rolesTitle")}</p>
        {isAdmin ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11 px-2 text-xs"
            onClick={() => requestEditRole("new")}
          >
            <Plus className="me-1 h-3 w-3" />
            {t("users.permissions.addRole")}
          </Button>
        ) : null}
      </div>
      {roles.length === 0 ? (
        <EmptyState variant="dashed" title={t("users.permissions.emptyRoles")} compact />
      ) : null}
      {roles.map((workspaceRole) => (
        <div
          key={workspaceRole.id}
          role="button"
          tabIndex={0}
          onClick={() => requestSelectRole(workspaceRole)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              requestSelectRole(workspaceRole);
            }
          }}
          className={`w-full cursor-pointer rounded-xl border-2 p-3 text-start transition-all ${
            displayRole?.id === workspaceRole.id
              ? "border-primary bg-primary/5"
              : "border-border bg-card hover:border-primary/40"
          }`}
        >
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {workspaceRole.isSystem ? (
                  <UserRoleBadge roleId={workspaceRole.id} />
                ) : (
                  <Badge as="span" tone={workspaceRole.badgeVariant} size="sm">
                    {workspaceRoleLabel(workspaceRole, t)}
                  </Badge>
                )}
                {workspaceRole.isSystem ? (
                  <Badge as="span" tone="muted" size="sm">
                    {t("users.permissions.systemBadge")}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {workspaceRoleDescription(workspaceRole, t)}
              </p>
            </div>
            {!workspaceRole.isSystem && isAdmin ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={(event) => {
                  event.stopPropagation();
                  requestEditRole(workspaceRole);
                }}
                className="shrink-0 rounded text-muted-foreground transition-colors hover:text-primary shadow-none hover:bg-transparent"
                aria-label={t("users.permissions.editRoleDetails", {
                  name: workspaceRoleLabel(workspaceRole, t),
                })}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
