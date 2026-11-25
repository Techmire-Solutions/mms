import React, { useState } from "react";
import {
  SECTION_STUDENT_ROLES,
  sectionStudentRoleBodySchema,
  type SectionStudentRoleKind,
} from "@mms/contracts";
import { Button } from "@mms/ui";
import { DatePicker } from "@mms/fe-core/components/DatePicker";
import { EmptyState } from "@mms/ui";
import { Field, FormSelect } from "@mms/fe-core/components/FormPrimitives";
import { notify } from "@mms/fe-core/notify";
import { Alert } from "@mms/ui";
import { useTranslation } from "@mms/fe-core/i18n";
import { useWorkspaceToday } from "../../host/useWorkspaceToday";
import { useEnrollmentsCollection } from "../../host/enrollmentsCollection";
import { useSectionStaffMutations, useSectionStudentRoles } from "../../hooks/useSectionStaff";
import { SectionAssignmentRow } from "./SectionAssignmentRow";

export interface SectionStudentRolesPanelProps {
  sectionId: string;
  classId: string;
}

/** Student monitors / assistants of a section (enrollment-based, never faculty). */
export function SectionStudentRolesPanel({
  sectionId,
  classId,
}: SectionStudentRolesPanelProps): React.JSX.Element {
  const { t } = useTranslation();
  const today = useWorkspaceToday();
  const roles = useSectionStudentRoles(sectionId);
  const { addRole, endRole } = useSectionStaffMutations(sectionId);
  const enrolled = useEnrollmentsCollection({ classId }).filter(
    (enrollment: any) =>
      enrollment.sectionId === sectionId &&
      enrollment.status !== "cancelled" &&
      !enrollment.deletedAt,
  );
  const [enrollmentId, setEnrollmentId] = useState("");
  const [role, setRole] = useState<SectionStudentRoleKind>("monitor");
  const [startOn, setStartOn] = useState(today);
  const [attempted, setAttempted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const roleLabel = (value: string) =>
    t(`sessions.studentRoles.role.${value as SectionStudentRoleKind}`);
  const rows = roles.data ?? [];

  const fail = (error: unknown) =>
    notify.error(t("sessions.staff.failed"), {
      description: error instanceof Error ? error.message : undefined,
    });

  const add = async () => {
    setAttempted(true);
    setFormError(null);
    // Shared write schema (single source of truth) instead of hand-rolled presence checks.
    const parsed = sectionStudentRoleBodySchema.safeParse({ enrollmentId, role, startOn });
    if (!parsed.success) {
      setFormError(t("common.formPleaseFixErrors"));
      return;
    }
    try {
      await addRole.mutateAsync(parsed.data);
      notify.success(t("sessions.staff.assigned"));
      setEnrollmentId("");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t("sessions.staff.failed"));
      fail(error);
    }
  };

  return (
    <div className="space-y-5 text-start">
      {formError ? <Alert role="alert" density="compact" description={formError} /> : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field
          id="student-role-enrollment"
          label={t("sessions.studentRoles.student")}
          required
          error={attempted && !enrollmentId ? t("common.formPleaseFixErrors") : undefined}
        >
          <FormSelect
            id="student-role-enrollment"
            value={enrollmentId}
            onChange={setEnrollmentId}
            placeholder={t("sessions.studentRoles.student")}
            options={enrolled.map((enrollment: any) => ({
              value: String(enrollment.id),
              label: enrollment.studentName,
            }))}
          />
        </Field>
        <Field id="student-role-role" label={t("sessions.staff.role")} required>
          <FormSelect
            id="student-role-role"
            value={role}
            onChange={(value) => setRole(value as SectionStudentRoleKind)}
            options={SECTION_STUDENT_ROLES.map((value) => ({ value, label: roleLabel(value) }))}
          />
        </Field>
        <Field
          id="student-role-start"
          label={t("sessions.staff.startOn")}
          required
          error={attempted && !startOn ? t("common.formPleaseFixErrors") : undefined}
        >
          <DatePicker id="student-role-start" value={startOn} onChange={setStartOn} required />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button
          type="button"
          className="min-h-11"
          disabled={!enrollmentId || !startOn || addRole.isPending}
          onClick={() => void add()}
        >
          {t("sessions.studentRoles.add")}
        </Button>
      </div>
      {rows.length === 0 ? (
        <EmptyState title={t("sessions.studentRoles.empty")} compact variant="dashed" />
      ) : (
        <div className="space-y-2">
          {rows.map((row: any) => (
            <SectionAssignmentRow
              key={row.id}
              assignment={row}
              roleLabel={roleLabel}
              pending={endRole.isPending}
              onEnd={
                row.endOn === null
                  ? (endOn) => void endRole.mutateAsync({ roleId: row.id, endOn }).catch(fail)
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
