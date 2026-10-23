import type React from "react";
import { Briefcase } from "lucide-react";
import { DatePicker } from "@/components/app/DatePicker";
import { Field } from "@/components/app/FormPrimitives";
import { FormSelect } from "@/components/app/FormSelect";
import { SectionCard } from "@/components/app/SectionCard";
import { useTranslation } from "@/hooks/useTranslation";
import {
  resolveFacultyStatus,
  type Contact,
  type FieldDefinition,
  type FacultyMember,
  type FacultyContractType,
} from "@mms/shared";
import { resolveFacultyFieldLabel } from "@/tenant/features/faculty/components/FacultyFormSectionShared";
import { FacultyEmploymentEmployeeIdField } from "@/tenant/features/faculty/components/FacultyEmploymentEmployeeIdField";

export interface FacultySectionBaseProps {
  facultyDraft?: Partial<FacultyMember>;
  errors: Record<string, string>;
  fields: Record<string, FieldDefinition[]>;
  onDraftChange: (patch: Partial<FacultyMember>) => void;
  isFieldEnabled: (fieldId: string) => boolean;
  isFieldRequired: (fieldId: string) => boolean;
}

export interface FacultyStatusOption {
  value: string;
  label: string;
}

export interface FacultyEmploymentSectionProps extends FacultySectionBaseProps {
  autoGenerateId: boolean;
  idPrefix: string;
  nextEmployeeId?: string;
  onRegenerateEmployeeId?: () => void;
  isFetchingNextEmployeeId?: boolean;
  statusOptions: FacultyStatusOption[];
  faculty?: FacultyMember;
  linkedFacultyContactIds?: Array<string | number>;
  linkedContact?: Contact | null;
}

/**
 * Employment card: Employee Code, lifecycle status, employment start/end dates.
 */
export function FacultyEmploymentSection(
  props: FacultyEmploymentSectionProps,
): React.JSX.Element | null {
  const {
    autoGenerateId,
    errors,
    fields,
    idPrefix,
    nextEmployeeId,
    onRegenerateEmployeeId,
    isFetchingNextEmployeeId,
    statusOptions,
    isFieldEnabled,
    isFieldRequired,
    onDraftChange,
  } = props;
  const faculty = props.faculty;
  const facultyDraft = props.facultyDraft ?? {};
  const { t } = useTranslation();
  const showEmployeeId = isFieldEnabled("employeeId");
  const showStatus = isFieldEnabled("status");
  const showStartDate = isFieldEnabled("employmentStartDate") || isFieldEnabled("joinDate");
  const showEndDate = isFieldEnabled("employmentEndDate");
  if (!showEmployeeId && !showStatus && !showStartDate && !showEndDate) {
    return null;
  }

  const lbl = (field: string) => resolveFacultyFieldLabel(fields, "employment", field, t);
  const startDate = facultyDraft.employmentStartDate ?? facultyDraft.joinDate ?? undefined;
  const endDate = facultyDraft.employmentEndDate ?? undefined;

  return (
    <div className="space-y-4 text-start">
      <SectionCard
        title={t("faculty.form.sectionEmployment")}
        icon={Briefcase}
        accentColor="primary"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          {showEmployeeId && (
            <FacultyEmploymentEmployeeIdField
              label={lbl("employeeId")}
              required={isFieldRequired("employeeId")}
              error={errors.employeeId}
              employeeId={facultyDraft.employeeId}
              idPrefix={idPrefix}
              autoGenerateId={autoGenerateId}
              isExistingFaculty={Boolean(faculty?.id)}
              nextEmployeeId={nextEmployeeId}
              isFetchingNextEmployeeId={isFetchingNextEmployeeId}
              onDraftChange={onDraftChange}
              onRegenerateEmployeeId={onRegenerateEmployeeId}
              t={t}
            />
          )}

          {showStatus && (
            <Field
              label={lbl("status")}
              id="status"
              required={isFieldRequired("status")}
              error={errors.status}
            >
              <FormSelect
                id="status"
                name="status"
                value={resolveFacultyStatus(facultyDraft.status)}
                onChange={(val) => onDraftChange({ status: val as FacultyMember["status"] })}
                options={statusOptions}
              />
            </Field>
          )}

          <Field
            label={t("faculty.contract.type")}
            id="faculty-employment-contract-type"
          >
            <FormSelect
              id="faculty-employment-contract-type"
              name="employmentContractType"
              value={facultyDraft.employmentContractType ?? ""}
              onChange={(val) =>
                onDraftChange({
                  employmentContractType: (val || null) as FacultyContractType | null,
                })
              }
              options={[
                { value: "", label: t("common.notSpecified") },
                { value: "salaried", label: t("faculty.contract.salaried") },
                { value: "wazifa", label: t("faculty.contract.wazifa") },
                { value: "hourly", label: t("faculty.contract.hourly") },
                { value: "voluntary", label: t("faculty.contract.voluntary") },
              ]}
            />
          </Field>

          {showStartDate && (
            <Field
              label={lbl("employmentStartDate")}
              id="faculty-employment-start-date"
              required={isFieldRequired("employmentStartDate") || isFieldRequired("joinDate")}
              error={errors.employmentStartDate || errors.joinDate}
            >
              <DatePicker
                id="faculty-employment-start-date"
                name="employmentStartDate"
                value={startDate || undefined}
                max={endDate}
                onChange={(dateStr) => onDraftChange({ employmentStartDate: dateStr })}
              />
            </Field>
          )}

          {showEndDate && (
            <Field
              label={lbl("employmentEndDate")}
              id="faculty-employment-end-date"
              required={isFieldRequired("employmentEndDate")}
              error={errors.employmentEndDate}
            >
              <DatePicker
                id="faculty-employment-end-date"
                name="employmentEndDate"
                value={endDate || undefined}
                min={startDate}
                onChange={(dateStr) => onDraftChange({ employmentEndDate: dateStr || null })}
              />
            </Field>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
