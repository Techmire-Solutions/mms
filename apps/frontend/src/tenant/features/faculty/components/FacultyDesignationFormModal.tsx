import React, { useMemo, useState } from "react";
import { Award } from "lucide-react";
import {
  collectDesignationDescendantIds,
  type FacultyCatalogStatus,
  type FacultyDepartmentEntity,
  type FacultyDesignationDefinition,
} from "@mms/shared";
import { FormModal } from "@/components/app/FormModal";
import { useTranslation } from "@/hooks/useTranslation";
import type { FacultyDesignationFormPayload } from "../hooks/useFacultyDesignationsController";
import { FacultyDesignationFormFields } from "./FacultyDesignationFormFields";

export interface FacultyDesignationFormModalProps {
  open: boolean;
  onClose: () => void;
  designation: FacultyDesignationDefinition | null;
  departments: readonly FacultyDepartmentEntity[];
  designationOptions?: readonly FacultyDesignationDefinition[];
  isPending: boolean;
  /** Pre-selects a department for quick-create from the faculty form. */
  defaultDepartmentId?: string;
  onOpenCreateDepartment?: () => void;
  /** Resolves true when the save succeeded (modal closes), false to keep it open. */
  onSave: (payload: FacultyDesignationFormPayload) => Promise<boolean>;
}

const isLive = (row: { status?: string; deletedAt?: string | null }) =>
  row.status !== "inactive" && !row.deletedAt;

interface FacultyDesignationFormContentProps {
  open: boolean;
  onClose: () => void;
  designation: FacultyDesignationDefinition | null;
  departments: readonly FacultyDepartmentEntity[];
  designationOptions?: readonly FacultyDesignationDefinition[];
  isPending: boolean;
  defaultDepartmentId?: string;
  onOpenCreateDepartment?: () => void;
  onSave: (payload: FacultyDesignationFormPayload) => Promise<boolean>;
}

function FacultyDesignationFormContent({
  open,
  onClose,
  designation,
  departments,
  designationOptions = [],
  isPending,
  defaultDepartmentId = "",
  onOpenCreateDepartment,
  onSave,
}: FacultyDesignationFormContentProps): React.JSX.Element {
  const { t } = useTranslation();
  const [departmentId, setDepartmentId] = useState(
    () => designation?.departmentId ?? defaultDepartmentId,
  );
  const [name, setName] = useState(() => designation?.name ?? "");
  const [parentDesignationId, setParentDesignationId] = useState(
    () => designation?.parentDesignationId ?? "",
  );
  const [status, setStatus] = useState<FacultyCatalogStatus>(
    () => designation?.status ?? "active",
  );
  const [assignableRoles, setAssignableRoles] = useState<string[]>(
    () => designation?.assignableRoles ?? [],
  );

  const departmentOptions = useMemo(
    () =>
      departments
        .filter((d) => isLive(d) || d.id === designation?.departmentId)
        .map((d) => ({ value: d.id, label: d.name })),
    [departments, designation?.departmentId],
  );

  /** Parents live in the same department and cannot be the designation itself or one of its descendants. */
  const parentOptions = useMemo(() => {
    const forbidden = designation
      ? collectDesignationDescendantIds(designationOptions, designation.id)
      : new Set<string>();
    return [
      { value: "", label: t("faculty.designations.topLevel") },
      ...designationOptions
        .filter((d) => d.departmentId === departmentId && !forbidden.has(d.id) && !d.deletedAt)
        .map((d) => ({ value: d.id, label: d.name })),
    ];
  }, [designation, designationOptions, departmentId, t]);

  const statusOptions = useMemo(
    () => [
      { value: "active", label: t("faculty.status.active") },
      { value: "inactive", label: t("faculty.status.inactive") },
    ],
    [t],
  );

  const trimmedName = name.trim();
  const duplicateName = designationOptions.some(
    (d) =>
      d.id !== designation?.id &&
      !d.deletedAt &&
      d.departmentId === departmentId &&
      d.name.trim().toLowerCase() === trimmedName.toLowerCase(),
  );

  const isDirty = designation
    ? departmentId !== designation.departmentId ||
      name !== designation.name ||
      parentDesignationId !== (designation.parentDesignationId ?? "") ||
      status !== designation.status ||
      JSON.stringify(assignableRoles) !== JSON.stringify(designation.assignableRoles ?? [])
    : Boolean(
        trimmedName ||
        parentDesignationId ||
        status !== "active" ||
        departmentId !== defaultDepartmentId ||
        assignableRoles.length > 0,
      );

  const handleDepartmentChange = (next: string) => {
    setDepartmentId(next);
    setParentDesignationId("");
  };

  const handleSubmit = async () => {
    if (!trimmedName || !departmentId || duplicateName) return;
    const saved = await onSave({
      id: designation?.id,
      departmentId,
      name: trimmedName,
      parentDesignationId: parentDesignationId || null,
      status,
      assignableRoles,
    });
    if (saved) onClose();
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={
        designation
          ? t("faculty.designations.editDesignation")
          : t("faculty.designations.addDesignation")
      }
      subtitle={t("faculty.designations.modalSubtitle")}
      icon={Award}
      size="lg"
      cancelLabel={t("common.cancel")}
      saveLabel={designation ? t("common.save") : t("faculty.designations.addDesignation")}
      saving={isPending}
      saveDisabled={isPending || !trimmedName || !departmentId || duplicateName}
      isDirty={isDirty}
      discardUnsavedTitle={t("faculty.form.discardUnsavedTitle")}
      discardUnsavedDescription={t("faculty.form.discardUnsavedDescription")}
      discardConfirmLabel={t("faculty.form.discardChanges")}
      discardCancelLabel={t("faculty.form.keepEditing")}
      onSave={() => void handleSubmit()}
    >
      <FacultyDesignationFormFields
        departmentId={departmentId}
        name={name}
        parentDesignationId={parentDesignationId}
        status={status}
        assignableRoles={assignableRoles}
        departmentOptions={departmentOptions}
        parentOptions={parentOptions}
        statusOptions={statusOptions}
        isPending={isPending}
        nameError={duplicateName ? t("faculty.designations.nameDuplicate") : undefined}
        onDepartmentChange={handleDepartmentChange}
        onNameChange={setName}
        onParentChange={setParentDesignationId}
        onStatusChange={(val) => setStatus(val === "inactive" ? "inactive" : "active")}
        onAssignableRolesChange={setAssignableRoles}
        onOpenCreateDepartment={onOpenCreateDepartment}
      />
    </FormModal>
  );
}

/** Faculty Management model — Designation modal: department, name, parent (self-referencing), status. */
export function FacultyDesignationFormModal(
  props: FacultyDesignationFormModalProps,
): React.JSX.Element | null {
  if (!props.open) return null;

  return (
    <FacultyDesignationFormContent
      key={props.designation?.id ?? `new-${props.defaultDepartmentId ?? ""}`}
      {...props}
    />
  );
}
