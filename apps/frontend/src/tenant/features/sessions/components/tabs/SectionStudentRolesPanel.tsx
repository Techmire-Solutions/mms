import React, { useState } from 'react';
import { SECTION_STUDENT_ROLES, todayISO, type SectionStudentRoleKind } from '@mms/shared';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/DatePicker';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field, FormSelect } from '@/components/ui/FormPrimitives';
import { notify } from '@/lib/notify';
import { useTranslation } from '@/hooks/useTranslation';
import { useEnrollmentsCollection } from '@/tenant/hooks/collections/enrollments';
import { useSectionStaffMutations, useSectionStudentRoles } from '@/tenant/features/sessions/hooks/useSectionStaff';
import { SectionAssignmentRow } from './SectionAssignmentRow';

export interface SectionStudentRolesPanelProps {
  sectionId: string;
  classId: string;
}

/** Student monitors / assistants of a section (enrollment-based, never faculty). */
export function SectionStudentRolesPanel({ sectionId, classId }: SectionStudentRolesPanelProps): React.JSX.Element {
  const { t } = useTranslation();
  const roles = useSectionStudentRoles(sectionId);
  const { addRole, endRole } = useSectionStaffMutations(sectionId);
  const enrolled = useEnrollmentsCollection({ classId })
    .filter((enrollment) => enrollment.sectionId === sectionId && enrollment.status !== 'cancelled' && !enrollment.deletedAt);
  const [enrollmentId, setEnrollmentId] = useState('');
  const [role, setRole] = useState<SectionStudentRoleKind>('monitor');
  const [startOn, setStartOn] = useState(todayISO());
  const roleLabel = (value: string) => t(`sessions.studentRoles.role.${value as SectionStudentRoleKind}`);
  const rows = roles.data ?? [];

  const fail = (error: unknown) => notify.error(t('sessions.staff.failed'), { description: error instanceof Error ? error.message : undefined });

  const add = async () => {
    try {
      await addRole.mutateAsync({ enrollmentId, role, startOn });
      notify.success(t('sessions.staff.assigned'));
      setEnrollmentId('');
    } catch (error) {
      fail(error);
    }
  };

  return (
    <div className="space-y-5 text-start">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field id="student-role-enrollment" label={t('sessions.studentRoles.student')} required>
          <FormSelect id="student-role-enrollment" value={enrollmentId} onChange={setEnrollmentId}
            placeholder={t('sessions.studentRoles.student')}
            options={enrolled.map((enrollment) => ({ value: String(enrollment.id), label: enrollment.studentName }))} />
        </Field>
        <Field id="student-role-role" label={t('sessions.staff.role')} required>
          <FormSelect id="student-role-role" value={role} onChange={(value) => setRole(value as SectionStudentRoleKind)}
            options={SECTION_STUDENT_ROLES.map((value) => ({ value, label: roleLabel(value) }))} />
        </Field>
        <Field id="student-role-start" label={t('sessions.staff.startOn')} required>
          <DatePicker id="student-role-start" value={startOn} onChange={setStartOn} required />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="button" className="min-h-11" disabled={!enrollmentId || !startOn || addRole.isPending} onClick={() => void add()}>
          {t('sessions.studentRoles.add')}
        </Button>
      </div>
      {rows.length === 0 ? <EmptyState title={t('sessions.studentRoles.empty')} compact variant="dashed" /> : (
        <div className="space-y-2">
          {rows.map((row) => (
            <SectionAssignmentRow
              key={row.id}
              assignment={row}
              roleLabel={roleLabel}
              pending={endRole.isPending}
              onEnd={row.endOn === null ? (endOn) => void endRole.mutateAsync({ roleId: row.id, endOn }).catch(fail) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
