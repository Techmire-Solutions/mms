import React, { useMemo } from "react";
import { Info } from "lucide-react";
import {
  formatDesignationOptionLabel,
  resolveRoleDisplayName,
  type FacultyDepartmentEntity,
  type FacultyDesignationDefinition,
  type FacultyMember,
} from "@mms/shared";
import { Field, FormSelectWithQuickCreate } from "@/components/ui/FormPrimitives";
import { useTranslation } from "@/hooks/useTranslation";
import { useWorkspaceRoles } from "@/tenant/hooks/useWorkspaceRoles";
import {
  buildDesignationDraftPatch,
  selectableDesignationOptions,
} from "./facultyFormDesignationDraft";

export interface FacultyDesignationSelectFieldProps {
  id?: string;
  designationId?: string | null;
  designationName?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  designationOptions?: FacultyDesignationDefinition[];
  departmentEntities?: FacultyDepartmentEntity[];
  canAdd?: boolean;
  onOpenAdd?: () => void;
  /** Receives the full designation-derived patch (designation, department, roles, parent). */
  onChange: (patch: Partial<FacultyMember>) => void;
}

/** Single designation select — options read "Department · Designation · Role". */
export function FacultyDesignationSelectField({
  id = "designationId",
  designationId,
  designationName,
  error,
  required,
  disabled,
  designationOptions = [],
  departmentEntities = [],
  canAdd = false,
  onOpenAdd,
  onChange,
}: FacultyDesignationSelectFieldProps): React.JSX.Element {
  const { t } = useTranslation();
  const workspaceRoles = useWorkspaceRoles();

  const activeOptions = useMemo(
    () => selectableDesignationOptions(designationOptions, designationId),
    [designationOptions, designationId],
  );

  const selectOptions = useMemo(
    () =>
      activeOptions.map((item) => {
        const roleId = item.assignableRoles?.[0];
        const roleLabel = roleId ? resolveRoleDisplayName(roleId, workspaceRoles, t) : undefined;
        return { value: item.id, label: formatDesignationOptionLabel(item, roleLabel) };
      }),
    [activeOptions, t, workspaceRoles],
  );

  return (
    <Field label={t("faculty.field.designation")} id={id} required={required} error={error}>
      <FormSelectWithQuickCreate
        id={id}
        name={id}
        value={designationId || ""}
        placeholder={t("faculty.designations.selectPlaceholder")}
        disabled={disabled}
        canAdd={canAdd}
        onOpenAdd={onOpenAdd}
        addAriaLabel={t("faculty.designations.addDesignation")}
        onChange={(value) => {
          const def = designationOptions.find((item) => item.id === value);
          onChange(buildDesignationDraftPatch(def, departmentEntities));
        }}
        options={selectOptions}
      />
      {activeOptions.length === 0 ? (
        <p role="status" className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Info className="size-3.5 shrink-0" aria-hidden />
          {t("faculty.designations.empty")}
        </p>
      ) : null}
      {!designationId && designationName ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {t("faculty.designations.current")}: {designationName}
        </p>
      ) : null}
    </Field>
  );
}
