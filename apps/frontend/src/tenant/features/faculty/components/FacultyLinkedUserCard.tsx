import type React from "react";
import { UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/app/FormPrimitives";
import { SectionCard } from "@/components/app/SectionCard";
import { useTranslation } from "@/hooks/useTranslation";
import {
  resolveRoleDisplayName,
  workspaceRoleDescription,
  workspaceRoleLabel,
  type WorkspaceRole,
} from "@mms/shared";

export interface FacultyLinkedUserCardProps {
  linkedUser: { email?: string; role?: string };
  workspaceRoles: WorkspaceRole[];
  selectedRoleObj?: WorkspaceRole;
  errors: Record<string, string>;
}

export function FacultyLinkedUserCard({
  linkedUser,
  workspaceRoles,
  selectedRoleObj,
  errors,
}: FacultyLinkedUserCardProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <SectionCard
      title={t("faculty.form.linkedUserAccount")}
      icon={UserCheck}
      accentColor="primary"
      className="z-elevated"
    >
      <div className="space-y-4 text-start">
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-border bg-muted/20">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-foreground">{linkedUser.email}</p>
            <p className="text-xs text-muted-foreground">
              {t("faculty.form.linkedUserAccountHint")}
            </p>
          </div>
        </div>

        <Field label={t("users.fieldRole")} id="linked-user-role" error={errors["user.role"]}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="primary" size="sm">
              {selectedRoleObj
                ? workspaceRoleLabel(selectedRoleObj, t)
                : resolveRoleDisplayName(linkedUser.role || "teacher", workspaceRoles, t)}
            </Badge>
            {selectedRoleObj && workspaceRoleDescription(selectedRoleObj, t) ? (
              <span className="text-xs text-muted-foreground">
                {workspaceRoleDescription(selectedRoleObj, t)}
              </span>
            ) : null}
          </div>
        </Field>
      </div>
    </SectionCard>
  );
}
