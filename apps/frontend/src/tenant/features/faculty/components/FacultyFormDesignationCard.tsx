import type React from "react";
import { DatePicker } from "@/components/ui/DatePicker";
import { Field } from "@/components/ui/FormPrimitives";
import { FormSelect } from "@/components/ui/FormSelect";
import {
  FACULTY_PROFILE_STATUS_VALUES,
  resolveFacultyProfileStatus,
  type FacultyDepartmentEntity,
  type FacultyDesignationDefinition,
  type FacultyEmployDesignationFormRow,
  type FieldDefinition,
} from "@mms/shared";
import { FacultyDesignationSelectField } from "./FacultyDesignationSelectField";
import { resolveFacultyFieldLabel } from "./FacultyFormSectionShared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface FacultyFormDesignationCardProps {
  row: FacultyEmployDesignationFormRow;
  rowIndex: number;
  errors: Record<string, string>;
  fields: Record<string, FieldDefinition[]>;
  designationOptions: readonly FacultyDesignationDefinition[];
  departmentEntities: readonly FacultyDepartmentEntity[];
  isFieldEnabled: (fieldId: string) => boolean;
  isFieldRequired: (fieldId: string) => boolean;
  t: TranslationFunction;
  onRowChange: (clientId: string, patch: Partial<FacultyEmployDesignationFormRow>) => void;
  onDesignationCatalogChange: (clientId: string, designationId: string) => void;
  onOpenCreateDesignation: () => void;
}

/** One employ-designation tenure card — role lives on the catalog designation, not here. */
export function FacultyFormDesignationCard({
  row,
  rowIndex,
  errors,
  fields,
  designationOptions,
  departmentEntities,
  isFieldEnabled,
  isFieldRequired,
  t,
  onRowChange,
  onDesignationCatalogChange,
  onOpenCreateDesignation,
}: FacultyFormDesignationCardProps): React.JSX.Element {
  const showDesignation = isFieldEnabled("designation") || isFieldEnabled("designationId");
  const showStart = isFieldEnabled("designationStartDate");
  const showEnd = isFieldEnabled("designationEndDate");
  const showStatus = isFieldEnabled("employDesignationStatus") || isFieldEnabled("profileStatus");
  const statusValue = resolveFacultyProfileStatus(row.employDesignationStatus);
  const statusOptions = FACULTY_PROFILE_STATUS_VALUES.map((value) => ({
    value,
    label: t(`faculty.status.${value}` as "faculty.status.active"),
  }));
  const prefix = `designation-${rowIndex}`;

  return (
    <div className="space-y-4">
      {showDesignation ? (
        <FacultyDesignationSelectField
          id={`${prefix}-designationId`}
          designationId={row.designationId}
          designationName={designationOptions.find((d) => d.id === row.designationId)?.name}
          error={
            errors[`${prefix}.designationId`] ||
            (rowIndex === 0 ? errors.designation || errors.designationId : undefined)
          }
          required={isFieldRequired("designation") || isFieldRequired("designationId")}
          designationOptions={[...designationOptions]}
          departmentEntities={[...departmentEntities]}
          canAdd
          onOpenAdd={onOpenCreateDesignation}
          onChange={(patch) => {
            const nextId = typeof patch.designationId === "string" ? patch.designationId : "";
            onDesignationCatalogChange(row.clientId, nextId);
          }}
        />
      ) : null}
      {showStart || showEnd || showStatus ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          {showStart ? (
            <Field
              label={resolveFacultyFieldLabel(fields, "designation", "designationStartDate", t)}
              id={`${prefix}-start`}
              required={isFieldRequired("designationStartDate")}
              error={
                errors[`${prefix}.designationStartDate`] ||
                (rowIndex === 0 ? errors.designationStartDate : undefined)
              }
            >
              <DatePicker
                id={`${prefix}-start`}
                name={`${prefix}-start`}
                value={row.designationStartDate ?? undefined}
                max={row.designationEndDate ?? undefined}
                onChange={(dateStr) => onRowChange(row.clientId, { designationStartDate: dateStr })}
              />
            </Field>
          ) : null}
          {showEnd ? (
            <Field
              label={resolveFacultyFieldLabel(fields, "designation", "designationEndDate", t)}
              id={`${prefix}-end`}
              required={isFieldRequired("designationEndDate")}
              error={
                errors[`${prefix}.designationEndDate`] ||
                (rowIndex === 0 ? errors.designationEndDate : undefined)
              }
            >
              <DatePicker
                id={`${prefix}-end`}
                name={`${prefix}-end`}
                value={row.designationEndDate ?? undefined}
                min={row.designationStartDate ?? undefined}
                onChange={(dateStr) =>
                  onRowChange(row.clientId, { designationEndDate: dateStr || null })
                }
              />
            </Field>
          ) : null}
          {showStatus ? (
            <Field
              label={resolveFacultyFieldLabel(fields, "designation", "employDesignationStatus", t)}
              id={`${prefix}-status`}
              required={
                isFieldRequired("employDesignationStatus") || isFieldRequired("profileStatus")
              }
              error={
                errors[`${prefix}.employDesignationStatus`] ||
                (rowIndex === 0 ? errors.employDesignationStatus : undefined)
              }
            >
              <FormSelect
                id={`${prefix}-status`}
                name={`${prefix}-status`}
                value={statusValue}
                onChange={(val) =>
                  onRowChange(row.clientId, {
                    employDesignationStatus: resolveFacultyProfileStatus(val),
                  })
                }
                options={statusOptions}
              />
            </Field>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
