import React, { useState } from "react";
import { FACULTY_DESIGNATION_NAME_MAX } from "@mms/contracts";
import { Field } from "@mms/fe-core/components/FormPrimitives";
import { FORM_INPUT } from "@mms/ui";
import { FormSelect, type FormSelectOption } from "@mms/fe-core/components/FormSelect";
import { FormSelectWithQuickCreate } from "@mms/fe-core/components/FormSelectWithQuickCreate";
import { Input } from "@mms/ui";
import { useTranslation } from "@mms/fe-core/i18n";
import { FacultyDesignationRolesField } from "./FacultyDesignationRolesField";
import { RoleFormModal, useCreateWorkspaceRole } from "../host/users";

export interface FacultyDesignationFormFieldsProps {
  departmentId: string;
  name: string;
  parentDesignationId: string;
  status: string;
  assignableRoles: string[];
  departmentOptions: FormSelectOption[];
  parentOptions: FormSelectOption[];
  statusOptions: FormSelectOption[];
  isPending: boolean;
  nameError?: string;
  onDepartmentChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onParentChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onAssignableRolesChange: (roleIds: string[]) => void;
  /** When provided, a Plus control opens department quick-create. */
  onOpenCreateDepartment?: () => void;
}

/** Faculty Management model — Designation: department, name, parent, status, role. */
export function FacultyDesignationFormFields({
  departmentId,
  name,
  parentDesignationId,
  status,
  assignableRoles,
  departmentOptions,
  parentOptions,
  statusOptions,
  isPending,
  nameError,
  onDepartmentChange,
  onNameChange,
  onParentChange,
  onStatusChange,
  onAssignableRolesChange,
  onOpenCreateDepartment,
}: FacultyDesignationFormFieldsProps): React.JSX.Element {
  const { t } = useTranslation();
  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const { canCreate, visibleModules, createRole } = useCreateWorkspaceRole();

  return (
    <div className="space-y-4 py-1 text-start">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field
          label={t("faculty.designations.department")}
          id="modal-designation-department"
          required
        >
          <FormSelectWithQuickCreate
            id="modal-designation-department"
            name="departmentId"
            value={departmentId}
            onChange={onDepartmentChange}
            options={departmentOptions}
            placeholder={t("faculty.designations.departmentRequired")}
            disabled={isPending}
            canAdd={Boolean(onOpenCreateDepartment)}
            onOpenAdd={onOpenCreateDepartment}
            addAriaLabel={t("faculty.setup.addDepartment")}
          />
        </Field>

        <Field
          label={t("faculty.designations.name")}
          id="modal-designation-name"
          required
          error={nameError}
        >
          <Input
            id="modal-designation-name"
            name="name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={t("faculty.designations.namePlaceholder")}
            className={FORM_INPUT}
            maxLength={FACULTY_DESIGNATION_NAME_MAX}
            disabled={isPending}
            aria-invalid={nameError ? true : undefined}
          />
        </Field>

        <Field
          label={t("faculty.designations.parentDesignation")}
          id="modal-designation-parent"
          hint={!departmentId ? t("faculty.designations.selectDepartmentFirst") : undefined}
        >
          <FormSelect
            id="modal-designation-parent"
            name="parentDesignationId"
            value={parentDesignationId}
            onChange={onParentChange}
            options={parentOptions}
            disabled={isPending || !departmentId}
          />
        </Field>

        <Field label={t("common.status")} id="modal-designation-status" required>
          <FormSelect
            id="modal-designation-status"
            name="status"
            value={status}
            onChange={onStatusChange}
            options={statusOptions}
            disabled={isPending}
          />
        </Field>
      </div>

      <FacultyDesignationRolesField
        selectedRoleId={assignableRoles[0] ?? ""}
        disabled={isPending}
        canCreateRole={canCreate}
        onChange={(roleId) => onAssignableRolesChange(roleId ? [roleId] : [])}
        onOpenCreateRole={canCreate ? () => setCreateRoleOpen(true) : undefined}
      />
      <RoleFormModal
        open={createRoleOpen}
        title={t("faculty.designations.addRole")}
        visibleModules={visibleModules}
        onSave={(role: any) => {
          void (async () => {
            const created = await createRole(role);
            if (!created) return;
            setCreateRoleOpen(false);
            onAssignableRolesChange([created.id]);
          })();
        }}
        onClose={() => setCreateRoleOpen(false)}
      />
    </div>
  );
}
