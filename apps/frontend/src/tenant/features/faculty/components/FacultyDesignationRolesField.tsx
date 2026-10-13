import type React from "react";
import { useMemo } from "react";
import { workspaceRoleLabel } from "@mms/shared";
import { Field } from "@/components/app/FormPrimitives";
import { FormSelectWithQuickCreate } from "@/components/app/FormSelectWithQuickCreate";
import { useTranslation } from "@/hooks/useTranslation";
import { useWorkspaceRoles } from "@/tenant/hooks/useWorkspaceRoles";

export interface FacultyDesignationRolesFieldProps {
  /** Selected WorkspaceRole id, or empty string when none. */
  selectedRoleId: string;
  disabled?: boolean;
  canCreateRole?: boolean;
  onChange: (roleId: string) => void;
  onOpenCreateRole?: () => void;
  error?: string;
}

/**
 * Single-role dropdown of Users-module WorkspaceRoles for a designation,
 * with optional Plus to open RoleFormModal (via parent overlay).
 */
export function FacultyDesignationRolesField({
  selectedRoleId,
  disabled = false,
  canCreateRole = false,
  onChange,
  onOpenCreateRole,
  error,
}: FacultyDesignationRolesFieldProps): React.JSX.Element {
  const { t } = useTranslation();
  const workspaceRoles = useWorkspaceRoles();
  const options = useMemo(
    () => [
      { value: "", label: t("common.none") },
      ...workspaceRoles.map((role) => ({
        value: role.id,
        label: workspaceRoleLabel(role, t),
      })),
    ],
    [t, workspaceRoles],
  );

  return (
    <Field
      label={t("faculty.designations.role")}
      id="faculty-designation-role"
      error={error}
      hint={disabled ? t("faculty.designations.selectDesignationFirst") : undefined}
    >
      <FormSelectWithQuickCreate
        id="faculty-designation-role"
        name="assignableRole"
        value={selectedRoleId}
        onChange={onChange}
        options={options}
        disabled={disabled}
        canAdd={canCreateRole && Boolean(onOpenCreateRole)}
        onOpenAdd={onOpenCreateRole}
        addAriaLabel={t("faculty.designations.addRole")}
        aria-invalid={error ? true : undefined}
      />
    </Field>
  );
}
