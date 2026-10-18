import React, { useEffect, useMemo, useState } from "react";
import { Building2 } from "lucide-react";
import {
  FACULTY_DEPARTMENT_DESCRIPTION_MAX,
  FACULTY_DEPARTMENT_NAME_MAX,
  isDuplicateFacultyDepartmentName,
  type FacultyCatalogStatus,
  type FacultyDepartmentEntity,
} from "@mms/shared";
import { Field } from "@/components/app/FormPrimitives";
import { FormModal } from "@/components/app/FormModal";
import { FormSelect } from "@/components/app/FormSelect";
import { FORM_INPUT } from "@/components/ui/formStyles";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/hooks/useTranslation";
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

/** Faculty Management model — Department: name (unique, required), description, status. */
export function FacultyDepartmentFormModal({
  open,
  onClose,
  department,
  existingDepartments,
  isPending,
  onSave,
}: FacultyDepartmentFormModalProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<FacultyCatalogStatus>("active");

  const statusOptions = useMemo(
    () => [
      { value: "active", label: t("faculty.status.active") },
      { value: "inactive", label: t("faculty.status.inactive") },
    ],
    [t],
  );

  useEffect(() => {
    if (!open) return;
    setName(department?.name ?? "");
    setDescription(department?.description ?? "");
    setStatus(department?.status ?? "active");
  }, [open, department]);

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
    const saved = await onSave({
      id: department?.id,
      name: trimmedName,
      description: description.trim() || null,
      status,
    });
    if (saved) onClose();
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
      isDirty={isDirty}
      discardUnsavedTitle={t("faculty.form.discardUnsavedTitle")}
      discardUnsavedDescription={t("faculty.form.discardUnsavedDescription")}
      discardConfirmLabel={t("faculty.form.discardChanges")}
      discardCancelLabel={t("faculty.form.keepEditing")}
      onSave={() => void handleSubmit()}
    >
      <div className="space-y-4 py-1 text-start">
        <Field
          label={t("faculty.setup.departmentName")}
          id="department-form-name"
          required
          error={duplicateName ? t("faculty.setup.departmentNameDuplicate") : undefined}
        >
          <Input
            id="department-form-name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("faculty.setup.departmentNamePlaceholder")}
            className={FORM_INPUT}
            maxLength={FACULTY_DEPARTMENT_NAME_MAX}
            disabled={isPending}
            aria-invalid={duplicateName || undefined}
            autoFocus
          />
        </Field>

        <Field label={t("faculty.setup.departmentDescription")} id="department-form-description">
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
    </FormModal>
  );
}
