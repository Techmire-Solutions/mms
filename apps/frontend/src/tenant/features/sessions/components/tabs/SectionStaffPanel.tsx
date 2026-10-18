import React, { useState } from 'react';
import {
  formatFacultyDisplayName,
  SECTION_STAFF_ROLES,
  todayISO,
  type FacultyMember,
  type SectionStaffAssignment,
  type SectionStaffRole,
} from '@mms/shared';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/DatePicker';
import { Field, FormSelect } from '@/components/ui/FormPrimitives';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/EmptyState';
import { AcademicCatalogSelect } from '@/components/common/catalog/AcademicCatalogSelect';
import { notify } from '@/lib/notify';
import { useTranslation } from '@/hooks/useTranslation';
import { useSectionStaff, useSectionStaffMutations } from '@/tenant/features/sessions/hooks/useSectionStaff';
import { SectionAssignmentRow } from './SectionAssignmentRow';

export interface SectionStaffPanelProps {
  sectionId: string;
  allFaculty: FacultyMember[];
}

/** Assign / change section teachers and assistants from a date; lists current staff and history. */
export function SectionStaffPanel({ sectionId, allFaculty }: SectionStaffPanelProps): React.JSX.Element {
  const { t } = useTranslation();
  const staff = useSectionStaff(sectionId);
  const { assign, end } = useSectionStaffMutations(sectionId);
  const [facultyId, setFacultyId] = useState('');
  const [role, setRole] = useState<SectionStaffRole>('class_teacher');
  const [subjectId, setSubjectId] = useState('');
  const [startOn, setStartOn] = useState(todayISO());
  const [reason, setReason] = useState('');
  const rows: SectionStaffAssignment[] = staff.data ?? [];
  const current = rows.filter((row) => row.endOn === null);
  const history = rows.filter((row) => row.endOn !== null);
  const canSubmit = Boolean(facultyId && startOn && (role !== 'subject_teacher' || subjectId)) && !assign.isPending;

  const submit = async () => {
    try {
      await assign.mutateAsync({ facultyId, role, subjectId: role === 'class_teacher' ? null : subjectId || null, startOn, reason: reason.trim() || null });
      notify.success(t('sessions.staff.assigned'));
      setFacultyId('');
      setReason('');
    } catch (error) {
      notify.error(t('sessions.staff.failed'), { description: error instanceof Error ? error.message : undefined });
    }
  };

  const endAssignment = async (assignmentId: string, endOn: string) => {
    try {
      await end.mutateAsync({ assignmentId, endOn });
      notify.success(t('sessions.staff.ended'));
    } catch (error) {
      notify.error(t('sessions.staff.failed'), { description: error instanceof Error ? error.message : undefined });
    }
  };

  return (
    <div className="space-y-5 text-start">
      <p className="text-sm text-muted-foreground text-pretty">{t('sessions.staff.changeHint')}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field id="staff-faculty" label={t('sessions.staff.faculty')} required>
          <FormSelect id="staff-faculty" value={facultyId} onChange={setFacultyId}
            placeholder={t('sessions.staff.faculty')}
            options={allFaculty.map((member) => ({ value: String(member.id), label: formatFacultyDisplayName(member) }))} />
        </Field>
        <Field id="staff-role" label={t('sessions.staff.role')} required>
          <FormSelect id="staff-role" value={role} onChange={(value) => setRole(value as SectionStaffRole)}
            options={SECTION_STAFF_ROLES.map((value) => ({ value, label: t(`sessions.staff.role.${value}`) }))} />
        </Field>
        {role !== 'class_teacher' ? (
          <Field id="staff-subject" label={t('sessions.staff.subject')} required={role === 'subject_teacher'}>
            <AcademicCatalogSelect kind="subjects" id="staff-subject" value={subjectId} onChange={(id) => setSubjectId(id)} allowNone={role === 'assistant'} />
          </Field>
        ) : null}
        <Field id="staff-start" label={t('sessions.staff.startOn')} required>
          <DatePicker id="staff-start" value={startOn} onChange={setStartOn} required />
        </Field>
        <Field id="staff-reason" label={t('sessions.staff.reason')}>
          <Input id="staff-reason" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="button" className="min-h-11" disabled={!canSubmit} onClick={() => void submit()}>{t('sessions.staff.assign')}</Button>
      </div>

      <section aria-labelledby="staff-current" className="space-y-2">
        <h3 id="staff-current" className="text-sm font-semibold">{t('sessions.staff.current')}</h3>
        {current.length === 0
          ? <EmptyState title={t('sessions.staff.noStaff')} compact variant="dashed" />
          : current.map((row) => <SectionAssignmentRow key={row.id} assignment={row} pending={end.isPending} onEnd={(endOn) => void endAssignment(row.id, endOn)} />)}
      </section>
      {history.length > 0 ? (
        <section aria-labelledby="staff-history" className="space-y-2">
          <h3 id="staff-history" className="text-sm font-semibold">{t('sessions.staff.history')}</h3>
          {history.map((row) => <SectionAssignmentRow key={row.id} assignment={row} />)}
        </section>
      ) : null}
    </div>
  );
}
