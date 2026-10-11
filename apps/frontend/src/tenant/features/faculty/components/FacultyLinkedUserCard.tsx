import type React from "react";
import { UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/FormPrimitives";
import { FormSelect } from "@/components/ui/FormSelect";
import { SectionCard } from "@/components/ui/SectionCard";
import { useTranslation } from "@/hooks/useTranslation";
import { resolveRoleDisplayName, workspaceRoleDescription, type WorkspaceRole } from "@mms/shared";
import type { FacultyUserAccountDraft } from "@/tenant/features/faculty/components/FacultyUserAccountSection";

export interface FacultyLinkedUserCardProps {
  linkedUser: { email?: string; role?: string };
  userAccountDraft: FacultyUserAccountDraft;
  onUserAccountDraftChange: (draft: FacultyUserAccountDraft) => void;
  roleOptions: Array<{ value: string; label: string }>;
  workspaceRoles: WorkspaceRole[];
  selectedRoleObj?: WorkspaceRole;
  errors: Record<string, string>;
}

export function FacultyLinkedUserCard({
  linkedUser,
  userAccountDraft,
  onUserAccountDraftChange,
  roleOptions,
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
          <Badge pill tone="primary" className="px-2.5 font-bold">
            {resolveRoleDisplayName(linkedUser.role || "teacher", workspaceRoles, t)}
          </Badge>
        </div>

        <Field label={t("users.fieldRole")} id="linked-user-role" error={errors["user.role"]}>
          <FormSelect
            id="linked-user-role"
            name="linkedUserRole"
            value={userAccountDraft.role || linkedUser.role || "teacher"}
            onChange={(role) =>
              onUserAccountDraftChange({ ...userAccountDraft, enabled: true, role })
            }
            options={roleOptions}
          />
          {roleOptions.length === 0 ? (
            <p className="mt-1 text-xs text-destructive">
              {t("faculty.designations.noAssignableRoles")}
            </p>
          ) : null}
          {selectedRoleObj && workspaceRoleDescription(selectedRoleObj, t) ? (
            <p className="text-xs text-muted-foreground mt-1">
              {workspaceRoleDescription(selectedRoleObj, t)}
            </p>
          ) : null}
        </Field>
      </div>
    </SectionCard>
  );
}
