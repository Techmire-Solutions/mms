import React, { useMemo } from "react";
import { ShieldCheck } from "lucide-react";
import { SectionCard } from "@/components/ui/SectionCard";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "@/hooks/useTranslation";
import { useWorkspaceRoles } from "@/tenant/hooks/useWorkspaceRoles";
import { useUsersContractList } from "@/tenant/hooks/collections/users";
import {
  DEFAULT_FACULTY_USER_ROLE,
  getPrimaryEmail,
  workspaceRoleLabel,
  type Contact,
  type FacultyMember,
} from "@mms/shared";
import { FacultyLinkedUserCard } from "@/tenant/features/faculty/components/FacultyLinkedUserCard";
import { FacultyNewUserAccountFields } from "@/tenant/features/faculty/components/FacultyNewUserAccountFields";

export interface FacultyUserAccountDraft {
  enabled: boolean;
  role: string;
  setupMethod: "password" | "invite";
  password?: string;
  forceReset?: boolean;
}

export interface LinkedUserInfo {
  id: string;
  contactId?: string | number;
  email?: string;
  role?: string;
  status?: string;
}

export interface FacultyUserAccountSectionProps {
  facultyDraft?: Partial<FacultyMember>;
  linkedContact?: Contact | null;
  linkedUser?: LinkedUserInfo | null;
  userAccountDraft: FacultyUserAccountDraft;
  onUserAccountDraftChange: (draft: FacultyUserAccountDraft) => void;
  errors: Record<string, string>;
}

export function FacultyUserAccountSection(
  props: FacultyUserAccountSectionProps,
): React.JSX.Element {
  const {
    facultyDraft = {},
    linkedContact,
    linkedUser: linkedUserProp,
    userAccountDraft,
    onUserAccountDraftChange,
    errors,
  } = props;
  const { t } = useTranslation();
  const workspaceRoles = useWorkspaceRoles();
  const primaryEmail = linkedContact ? getPrimaryEmail(linkedContact) : null;

  const usersQuery = useUsersContractList(
    { limit: 100 },
    linkedUserProp === undefined && Boolean(facultyDraft.contactId),
  );
  const existingUsers = (usersQuery.data as { users?: LinkedUserInfo[] } | undefined)?.users;

  const linkedUser = useMemo(() => {
    if (linkedUserProp !== undefined) return linkedUserProp;
    if (!facultyDraft.contactId && !facultyDraft.userId) return null;
    return (
      existingUsers?.find(
        (u) =>
          (facultyDraft.userId && u.id === facultyDraft.userId) ||
          (facultyDraft.contactId && String(u.contactId) === String(facultyDraft.contactId)),
      ) ?? null
    );
  }, [linkedUserProp, existingUsers, facultyDraft.contactId, facultyDraft.userId]);

  const roleOptions = useMemo(() => {
    const allowedRoles = facultyDraft.designationAssignableRoles;
    return workspaceRoles
      .filter((role) => !facultyDraft.designationId || (allowedRoles ?? []).includes(role.id))
      .map((role) => ({
        value: role.id,
        label: `${workspaceRoleLabel(role, t)}${!role.isSystem ? ` (${t("contacts.form.tabCustom")})` : ""}`,
      }));
  }, [workspaceRoles, facultyDraft.designationAssignableRoles, facultyDraft.designationId, t]);

  const selectedRoleObj = useMemo(() => {
    const roleId = linkedUser ? userAccountDraft.role || linkedUser.role : userAccountDraft.role;
    return workspaceRoles.find((r) => r.id === roleId);
  }, [workspaceRoles, linkedUser, userAccountDraft.role]);

  if (linkedUser) {
    return (
      <FacultyLinkedUserCard
        linkedUser={linkedUser}
        userAccountDraft={userAccountDraft}
        onUserAccountDraftChange={onUserAccountDraftChange}
        roleOptions={roleOptions}
        workspaceRoles={workspaceRoles}
        selectedRoleObj={selectedRoleObj}
        errors={errors}
      />
    );
  }

  return (
    <SectionCard
      title={t("faculty.form.sectionUserAccount")}
      icon={ShieldCheck}
      accentColor="primary"
      className="z-elevated"
    >
      <div className="space-y-4 text-start">
        <div className="flex items-center justify-between gap-4 p-3 rounded-xl border border-border bg-muted/20">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-foreground">
              {t("faculty.form.grantLoginAccess")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("faculty.form.grantLoginAccessHint")}
            </p>
          </div>
          <Switch
            checked={userAccountDraft.enabled}
            onCheckedChange={(checked) =>
              onUserAccountDraftChange({
                ...userAccountDraft,
                enabled: checked,
                role: userAccountDraft.role || DEFAULT_FACULTY_USER_ROLE,
              })
            }
            aria-label={t("faculty.form.grantLoginAccess")}
          />
        </div>

        {userAccountDraft.enabled ? (
          <FacultyNewUserAccountFields
            primaryEmail={primaryEmail}
            userAccountDraft={userAccountDraft}
            onUserAccountDraftChange={onUserAccountDraftChange}
            roleOptions={roleOptions}
            selectedRoleObj={selectedRoleObj}
            errors={errors}
          />
        ) : null}
      </div>
    </SectionCard>
  );
}
