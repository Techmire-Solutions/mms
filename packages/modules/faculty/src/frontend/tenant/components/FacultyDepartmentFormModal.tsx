import { translateValidationMessage } from "@mms/fe-core/forms/translateValidationMessage";
import React, { useMemo, useState } from "react";
import { Building2 } from "lucide-react";
import {
  FACULTY_DEPARTMENT_DESCRIPTION_MAX,
  FACULTY_DEPARTMENT_NAME_MAX,
  facultyDepartmentWriteSchema,
  isDuplicateFacultyDepartmentName,
  type FacultyCatalogStatus,
  type FacultyDepartmentEntity,
} from "@mms/contracts";
import { Field } from "@mms/fe-core/components/FormPrimitives";
import { FormModal } from "@mms/fe-core/components/FormModal";
import { FormSelect } from "@mms/fe-core/components/FormSelect";
import { FORM_INPUT } from "@mms/ui";
import { Input } from "@mms/ui";
import { Textarea } from "@mms/ui";
import { useTranslation } from "@mms/fe-core/i18n";
import { mapApiFormError } from "@mms/fe-core/forms/serverFormErrors";
import { mapZodFormErrors } from "@mms/fe-core/forms/mapZodFormErrors";
import type { FacultyDepartmentFormPayload } from "../hooks/useFacultyDepartmentsController";

export interface FacultyDepartmentFormModalProps {
  open: boolean;
  onClose: () => void;
  department: FacultyDepartmentEntity | null;
  existingDepartments: FacultyDepartmentEntity[];
  isPending: boolean;
  /** Resolves true when the save succeeded (modal closes), false to keep it open. */
  onSave: (payload: FacultyDepartmentFormPayload) => Promise<boolean>;
}

interface FacultyDepartmentFormContentProps {
  open: boolean;
  onClose: () => void;
  department: FacultyDepartmentEntity | null;
  existingDepartments: FacultyDepartmentEntity[];
  isPending: boolean;
  onSave: (payload: FacultyDepartmentFormPayload) => Promise<boolean>;
}

function FacultyDepartmentFormContent({
  open,
  onClose,
  department,
  existingDepartments,
  isPending,
  onSave,
}: FacultyDepartmentFormContentProps): React.JSX.Element {
  const { t } = useTranslation();
  const [name, setName] = useState(() => department?.name ?? "");
  const [description, setDescription] = useState(() => department?.description ?? "");
  const [status, setStatus] = useState<FacultyCatalogStatus>(() => department?.status ?? "active");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const statusOptions = useMemo(
    () => [
      { value: "active", label: t("faculty.status.active") },
      { value: "inactive", label: t("faculty.status.inactive") },
    ],
    [t],
  );

  const trimmedName = name.trim();
  const duplicateName = isDuplicateFacultyDepartmentName(
    existingDepartments,
    trimmedName,
    department?.id ?? null,
  );

  const isDirty = department
    ? name !== department.name ||
      description !== (department.description ?? "") ||
      status !== department.status
    : Boolean(trimmedName || description.trim() || status !== "active");

  const handleSubmit = async () => {
    if (!trimmedName || duplicateName) return;
    setErrors({});
    setFormError(null);
    const parsed = facultyDepartmentWriteSchema.safeParse({
      ...(department?.id ? { id: department.id } : {}),
      name: trimmedName,
      description: description.trim() || null,
      status,
    });
    if (!parsed.success) {
      setErrors(
        mapZodFormErrors(parsed.error, (message) => translateValidationMessage(message, t)),
      );
      setFormError(t("common.formPleaseFixErrors"));
      return;
    }
    try {
      const saved = await onSave(parsed.data);
      if (saved) onClose();
    } catch (error) {
      setFormError(mapApiFormError(error).message ?? t("common.formPleaseFixErrors"));
    }
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={department ? t("faculty.setup.editDepartment") : t("faculty.setup.addDepartment")}
      subtitle={t("faculty.setup.addDepartmentSubtitle")}
      icon={Building2}
      size="md"
      cancelLabel={t("common.cancel")}
      saveLabel={
        department ? t("faculty.setup.updateDepartment") : t("faculty.setup.addDepartment")
      }
      saving={isPending}
      saveDisabled={isPending || !trimmedName || duplicateName}
      error={formError ?? undefined}
      isDirty={isDirty}
      discardUnsavedTitle={t("faculty.form.discardUnsavedTitle")}
      discardUnsavedDescription={t("faculty.form.discardUnsavedDescription")}
      discardConfirmLabel={t("faculty.form.discardChanges")}
      discardCancelLabel={t("faculty.form.keepEditing")}
      onSave={() => void handleSubmit()}
      formId="faculty-department-form"
    >
      <form
        id="faculty-department-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <div className="space-y-4 py-1 text-start">
          <Field
            label={t("faculty.setup.departmentName")}
            id="department-form-name"
            required
            error={
              duplicateName
                ? t("faculty.setup.departmentNameDuplicate")
                : (errors.name ?? undefined)
            }
          >
            <Input
              id="department-form-name"
              name="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: "" }));
              }}
              placeholder={t("faculty.setup.departmentNamePlaceholder")}
              className={FORM_INPUT}
              maxLength={FACULTY_DEPARTMENT_NAME_MAX}
              disabled={isPending}
              aria-invalid={duplicateName || undefined}
            />
          </Field>

          <Field
            label={t("faculty.setup.departmentDescription")}
            id="department-form-description"
            error={errors.description ?? undefined}
          >
            <Textarea
              id="department-form-description"
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("faculty.setup.departmentDescriptionPlaceholder")}
              maxLength={FACULTY_DEPARTMENT_DESCRIPTION_MAX}
              rows={3}
              disabled={isPending}
            />
          </Field>

          <Field label={t("common.status")} id="department-form-status" required>
            <FormSelect
              id="department-form-status"
              name="status"
              value={status}
              onChange={(val) => setStatus(val === "inactive" ? "inactive" : "active")}
              options={statusOptions}
              disabled={isPending}
            />
          </Field>
        </div>
      </form>
    </FormModal>
  );
}

/** Faculty Management model — Department: name (unique, required), description, status. */
export function FacultyDepartmentFormModal(
  props: FacultyDepartmentFormModalProps,
): React.JSX.Element | null {
  if (!props.open) return null;

  return <FacultyDepartmentFormContent key={props.department?.id ?? "new"} {...props} />;
}
