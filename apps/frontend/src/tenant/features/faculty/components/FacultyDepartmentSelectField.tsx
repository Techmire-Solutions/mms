import React, { useMemo } from "react";
import { isFacultyCatalogRowActive, type FacultyDepartmentEntity } from "@mms/shared";
import { Field, FormSelectWithQuickCreate } from "@/components/app/FormPrimitives";
import { useTranslation } from "@/hooks/useTranslation";

export interface FacultyDepartmentSelectFieldProps {
  id?: string;
  value: string;
  departmentId?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  departmentOptions?: string[];
  departmentEntities?: FacultyDepartmentEntity[];
  canAdd?: boolean;
  onOpenAdd?: () => void;
  onChange: (patch: { department: string; departmentId?: string }) => void;
}

export function FacultyDepartmentSelectField({
  id = "department",
  value,
  departmentId,
  error,
  required,
  disabled,
  departmentOptions,
  departmentEntities,
  canAdd = false,
  onOpenAdd,
  onChange,
}: FacultyDepartmentSelectFieldProps): React.JSX.Element {
  const { t } = useTranslation();

  const deptOptions = useMemo(() => {
    if (departmentEntities?.length) {
      const activeOrCurrent = departmentEntities.filter(
        (d) => isFacultyCatalogRowActive(d) || d.id === departmentId || d.name === value,
      );
      const list = activeOrCurrent.map((d) => ({ value: d.name, label: d.name }));
      if (value && !activeOrCurrent.some((d) => d.name === value)) {
        list.unshift({ value, label: value });
      }
      return list;
    }
    const raw: readonly string[] = departmentOptions ?? [];
    const exists = value ? raw.some((val) => val === value) : true;
    const list = value && !exists ? [value, ...raw] : [...raw];
    return list.map((opt) => ({ value: opt, label: opt }));
  }, [departmentEntities, departmentId, departmentOptions, value]);

  return (
    <Field label={t("faculty.field.department")} id={id} required={required} error={error}>
      <FormSelectWithQuickCreate
        id={id}
        name={id}
        value={value}
        placeholder={t("faculty.form.departmentPlaceholder")}
        disabled={disabled}
        canAdd={canAdd}
        onOpenAdd={onOpenAdd}
        addAriaLabel={t("faculty.setup.addDepartment")}
        onChange={(val) => {
          const matched = departmentEntities?.find((d) => d.name === val);
          onChange({
            department: val,
            ...(matched ? { departmentId: matched.id } : { departmentId: undefined }),
          });
        }}
        options={deptOptions}
      />
    </Field>
  );
}
