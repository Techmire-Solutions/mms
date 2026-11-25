import type React from "react";
import { AlertCircle } from "lucide-react";
import { Field } from "@mms/fe-core/components/FormPrimitives";
import { FormSelect } from "@mms/fe-core/components/FormSelect";
import { Badge } from "@mms/ui";
import { Checkbox } from "@mms/ui";
import { Label } from "@mms/ui";
import { PasswordInput } from "@mms/fe-core/components/PasswordInput";
import { useTranslation } from "@mms/fe-core/i18n";
import {
  DEFAULT_FACULTY_USER_ROLE,
  workspaceRoleDescription,
  workspaceRoleLabel,
  type WorkspaceRole,
} from "@mms/contracts";
import type { FacultyUserAccountDraft } from "./FacultyUserAccountSection";

export interface FacultyNewUserAccountFieldsProps {
  primaryEmail?: string | null;
  userAccountDraft: FacultyUserAccountDraft;
  onUserAccountDraftChange: (draft: FacultyUserAccountDraft) => void;
  selectedRoleObj?: WorkspaceRole;
  errors: Record<string, string>;
}

export function FacultyNewUserAccountFields({
  primaryEmail,
  userAccountDraft,
  onUserAccountDraftChange,
  selectedRoleObj,
  errors,
}: FacultyNewUserAccountFieldsProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 pt-2 border-t border-border/50">
      {!primaryEmail ? (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-warning/10 border border-warning/20 text-warning text-xs font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{t("faculty.form.noEmailWarning")}</span>
        </div>
      ) : null}

      <Field
        label={t("users.fieldRole")}
        id="faculty-user-role"
        required
        error={errors["user.role"]}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="primary" size="sm">
            {selectedRoleObj ? workspaceRoleLabel(selectedRoleObj, t) : DEFAULT_FACULTY_USER_ROLE}
          </Badge>
          {selectedRoleObj && workspaceRoleDescription(selectedRoleObj, t) ? (
            <span className="text-xs text-muted-foreground">
              {workspaceRoleDescription(selectedRoleObj, t)}
            </span>
          ) : null}
        </div>
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <Field label={t("users.addAccountMethod")} id="faculty-user-setup-method">
          <FormSelect
            id="faculty-user-setup-method"
            name="facultyUserSetupMethod"
            value={userAccountDraft.setupMethod}
            onChange={(val) =>
              onUserAccountDraftChange({
                ...userAccountDraft,
                setupMethod: val as "password" | "invite",
              })
            }
            options={[
              { value: "password", label: t("users.addMethodPassword") },
              { value: "invite", label: t("users.addMethodInvite") },
            ]}
          />
        </Field>

        {userAccountDraft.setupMethod === "password" ? (
          <Field
            label={t("auth.password")}
            id="faculty-user-password"
            required
            error={errors["user.password"]}
          >
            <PasswordInput
              id="faculty-user-password"
              name="password"
              autoComplete="new-password"
              minPasswordLength={8}
              value={userAccountDraft.password || ""}
              onChange={(e) =>
                onUserAccountDraftChange({ ...userAccountDraft, password: e.target.value })
              }
              placeholder="••••••••"
            />
          </Field>
        ) : null}
      </div>

      {userAccountDraft.setupMethod === "password" ? (
        <div className="flex min-h-11 items-center gap-2 pt-1 text-xs text-muted-foreground select-none font-medium">
          <Checkbox
            id="faculty-user-force-reset"
            checked={userAccountDraft.forceReset !== false}
            onCheckedChange={(checked) =>
              onUserAccountDraftChange({
                ...userAccountDraft,
                forceReset: Boolean(checked),
              })
            }
            className="cursor-pointer"
          />
          <Label
            htmlFor="faculty-user-force-reset"
            className="mb-0 cursor-pointer text-xs font-medium normal-case tracking-normal text-foreground select-none"
          >
            {t("users.addForceReset")}
          </Label>
        </div>
      ) : null}
    </div>
  );
}
