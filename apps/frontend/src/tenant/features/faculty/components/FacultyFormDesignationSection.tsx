import type React from "react";
import { useCallback, useMemo } from "react";
import { FormCollectionShell, FormListFieldCard } from "@/components/app/FormPrimitives";
import { useTranslation } from "@/hooks/useTranslation";
import type {
  FacultyDepartmentEntity,
  FacultyDesignationDefinition,
  FacultyEmployDesignationFormRow,
  FacultyMember,
  FieldDefinition,
} from "@mms/shared";
import { FacultyCatalogCreateOverlays } from "./FacultyCatalogCreateOverlays";
import { FacultyFormDesignationCard } from "./FacultyFormDesignationCard";
import { buildDesignationDraftPatch } from "../lib/facultyFormDesignationDraft";
import {
  employDesignationRowsFromFaculty,
  flatDraftPatchFromEmployDesignationRows,
  newEmployDesignationFormRow,
  pickPrimaryEmployDesignationRow,
} from "../lib/facultyEmployDesignationFormDraft";
import { useFacultyFormCatalogQuickCreate } from "../hooks/useFacultyFormCatalogQuickCreate";

export interface FacultyFormDesignationSectionProps {
  faculty?: FacultyMember;
  facultyDraft?: Partial<FacultyMember>;
  errors: Record<string, string>;
  fields?: Record<string, FieldDefinition[]>;
  designationOptions?: FacultyDesignationDefinition[];
  departmentOptions?: string[];
  departmentEntities?: FacultyDepartmentEntity[];
  showCollectionTitle?: boolean;
  isFieldEnabled: (fieldId: string) => boolean;
  isFieldRequired: (fieldId: string) => boolean;
  onDraftChange: (patch: Partial<FacultyMember>) => void;
}

function resolveFormRows(draft: Partial<FacultyMember>): FacultyEmployDesignationFormRow[] {
  const rows = employDesignationRowsFromFaculty(draft);
  return rows.length > 0 ? rows : [newEmployDesignationFormRow()];
}

/** Employ Designation collection — one card per tenure row for this contact's employment. */
export function FacultyFormDesignationSection(
  props: FacultyFormDesignationSectionProps,
): React.JSX.Element | null {
  const {
    facultyDraft = {},
    errors,
    fields = {},
    designationOptions = [],
    departmentEntities = [],
    isFieldEnabled,
    isFieldRequired,
    onDraftChange,
  } = props;
  const { t } = useTranslation();
  const catalogCreate = useFacultyFormCatalogQuickCreate();

  const showAny =
    isFieldEnabled("designation") ||
    isFieldEnabled("designationId") ||
    isFieldEnabled("designationStartDate") ||
    isFieldEnabled("designationEndDate") ||
    isFieldEnabled("employDesignationStatus") ||
    isFieldEnabled("profileStatus");

  const rows = useMemo(
    () => (showAny ? resolveFormRows(facultyDraft) : []),
    [
      showAny,
      facultyDraft.designationId,
      facultyDraft.employDesignations,
      facultyDraft.employDesignationId,
      facultyDraft.designationStartDate,
      facultyDraft.designationEndDate,
      facultyDraft.employDesignationStatus,
    ],
  );
  const primaryClientId = pickPrimaryEmployDesignationRow(rows)?.clientId;

  const commitRows = useCallback(
    (nextRows: FacultyEmployDesignationFormRow[]) => {
      const primary = pickPrimaryEmployDesignationRow(nextRows);
      const designation = primary?.designationId
        ? designationOptions.find((d) => d.id === primary.designationId)
        : undefined;
      onDraftChange({
        ...flatDraftPatchFromEmployDesignationRows(nextRows),
        ...(designation ? buildDesignationDraftPatch(designation, departmentEntities) : {}),
      });
    },
    [departmentEntities, designationOptions, onDraftChange],
  );

  if (!showAny) return null;

  const handleRowChange = (clientId: string, patch: Partial<FacultyEmployDesignationFormRow>) => {
    commitRows(rows.map((row) => (row.clientId === clientId ? { ...row, ...patch } : row)));
  };

  const handleDesignationCatalogChange = (clientId: string, designationId: string) => {
    const designation = designationOptions.find((d) => d.id === designationId);
    const nextRows = rows.map((row) =>
      row.clientId === clientId ? { ...row, designationId } : row,
    );
    const catalogPatch =
      clientId === primaryClientId && designation
        ? buildDesignationDraftPatch(designation, departmentEntities)
        : {};
    onDraftChange({
      ...flatDraftPatchFromEmployDesignationRows(nextRows),
      ...catalogPatch,
    });
  };

  const handleAdd = () => commitRows([...rows, newEmployDesignationFormRow()]);
  const handleRemove = (clientId: string) => {
    const next = rows.filter((row) => row.clientId !== clientId);
    commitRows(next.length > 0 ? next : [newEmployDesignationFormRow()]);
  };

  const applyDesignation = (designation: FacultyDesignationDefinition | undefined) => {
    if (!designation || !primaryClientId) {
      onDraftChange(buildDesignationDraftPatch(designation, departmentEntities));
      return;
    }
    handleDesignationCatalogChange(primaryClientId, designation.id);
  };

  return (
    <>
      <div className="space-y-4 pb-2 text-start">
        <FormCollectionShell
          isEmpty={false}
          addLabel={t("faculty.form.designations.addTenure")}
          onAdd={handleAdd}
          listKey="faculty-employ-designations"
        >
          {rows.map((row, index) => (
            <FormListFieldCard
              key={row.clientId}
              id={row.clientId}
              index={index}
              label={t("faculty.form.designationCard")}
              removeLabel={t("faculty.form.designations.removeTenure")}
              canRemove={rows.length > 1}
              onRemove={() => handleRemove(row.clientId)}
            >
              <FacultyFormDesignationCard
                row={row}
                rowIndex={index}
                errors={errors}
                fields={fields}
                designationOptions={designationOptions}
                departmentEntities={departmentEntities}
                isFieldEnabled={isFieldEnabled}
                isFieldRequired={isFieldRequired}
                t={t}
                onRowChange={handleRowChange}
                onDesignationCatalogChange={handleDesignationCatalogChange}
                onOpenCreateDesignation={catalogCreate.openCreateDesignation}
              />
            </FormListFieldCard>
          ))}
        </FormCollectionShell>
      </div>
      <FacultyCatalogCreateOverlays
        createDepartmentOpen={catalogCreate.createDepartmentOpen}
        onCloseDepartment={catalogCreate.closeDepartment}
        createDesignationOpen={catalogCreate.createDesignationOpen}
        onCloseDesignation={catalogCreate.closeDesignation}
        designationDefaultDepartmentId={
          typeof facultyDraft.departmentId === "string" ? facultyDraft.departmentId : undefined
        }
        onDepartmentCreated={(department) =>
          onDraftChange({ department: department.name, departmentId: department.id })
        }
        onDesignationCreated={applyDesignation}
      />
    </>
  );
}
