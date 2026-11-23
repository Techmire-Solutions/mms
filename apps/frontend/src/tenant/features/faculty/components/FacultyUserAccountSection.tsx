import React, { useEffect, useMemo } from "react";
import { ShieldCheck } from "lucide-react";
import { SectionCard } from "@/components/app/SectionCard";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "@/hooks/useTranslation";
import { useWorkspaceRoles } from "@/tenant/hooks/useWorkspaceRoles";
import { useUsersContractList } from "@/tenant/hooks/collections/users";
import {
  DEFAULT_FACULTY_USER_ROLE,
  getPrimaryEmail,
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

  // Seed the draft from the account's real role. Without this, enabling the
  // section and saving would write the untouched default (`staff`) over an
  // existing Admin/Principal role.
  useEffect(() => {
    const accountRole = linkedUser?.role?.trim();
    if (!accountRole) return;
    if (userAccountDraft.role?.trim() === accountRole) return;
    if (userAccountDraft.role?.trim() !== DEFAULT_FACULTY_USER_ROLE) return;
    onUserAccountDraftChange({ ...userAccountDraft, role: accountRole });
  }, [linkedUser?.role, userAccountDraft, onUserAccountDraftChange]);

  const assignableRoles = useMemo(
    () => facultyDraft.designationAssignableRoles ?? [],
    [facultyDraft.designationAssignableRoles],
  );
  const hasAssignableRole = assignableRoles.length > 0;
  const assignableRoleId = assignableRoles[0] ?? "";

  const selectedRoleObj = useMemo(() => {
    const roleId = linkedUser ? userAccountDraft.role || linkedUser.role : userAccountDraft.role;
    return workspaceRoles.find((r) => r.id === roleId);
  }, [workspaceRoles, linkedUser, userAccountDraft.role]);

  if (linkedUser) {
    return (
      <FacultyLinkedUserCard
        linkedUser={linkedUser}
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
              {hasAssignableRole
                ? t("faculty.form.grantLoginAccessHint")
                : t("faculty.designations.noAssignableRoles")}
            </p>
          </div>
          <Switch
            checked={userAccountDraft.enabled}
            disabled={!hasAssignableRole}
            onCheckedChange={(checked) =>
              onUserAccountDraftChange({
                ...userAccountDraft,
                enabled: checked,
                role: assignableRoleId || userAccountDraft.role || DEFAULT_FACULTY_USER_ROLE,
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
            selectedRoleObj={selectedRoleObj}
            errors={errors}
          />
        ) : null}
      </div>
    </SectionCard>
  );
}
