import React from 'react';
import { User, BookOpen, Layers, DollarSign, CheckCircle2 } from 'lucide-react';
import { formatDate } from '@mms/shared';
import { calcAge, type Student } from '@/lib/data/studentsData';
import { type Session, type Class } from '@/lib/data/sessionsData';
import { type CalculatedFee } from '@/lib/data/enrollmentData';
import { useFinanceCurrency } from '@/hooks/useCurrency';
import { useTranslation } from '@/hooks/useTranslation';
import { Field } from '@/components/ui/FormField';
import { Textarea } from '@/components/ui/textarea';
import { Step6ConfirmationRow, Step6ConfirmationSection } from '@/tenant/features/enrollments/components/wizard/step6ConfirmationLayout';


export interface Step6ConfirmationProps {
  student: Student | null | undefined;
  session: Session | null | undefined;
  classInfo: Class | null | undefined;
  feeResult: CalculatedFee | null | undefined;
  notes: string;
  onNotesChange: (notes: string) => void;
  customFieldValues: Record<string, unknown>;
  onCustomFieldChange: (id: string, value: unknown) => void;
}

/** Step 6 component for verifying all selected configuration details. */
export function Step6Confirmation({
  student,
  session,
  classInfo,
  feeResult,
  notes,
  onNotesChange,
  customFieldValues,
  onCustomFieldChange,
}: Step6ConfirmationProps): React.JSX.Element {
  const { t } = useTranslation();
  const age = student ? calcAge(student.dob) : null;
  const { formatCurrency } = useFinanceCurrency();

  return (
    <section className="space-y-4" aria-labelledby="step6-title">
      <div>
        <h3 id="step6-title" className="text-base font-bold text-foreground">{t('enrollments.wizard.step6Title')}</h3>
        <p className="text-sm text-muted-foreground mt-0.5">{t('enrollments.wizard.step6Desc')}</p>
      </div>

      <div className="space-y-3">
        <Step6ConfirmationSection icon={User} title={t('enrollments.wizard.step6SectionStudent')}>
          <Step6ConfirmationRow label={t('enrollments.detail.name')} value={student?.name} />
          <Step6ConfirmationRow label={t('enrollments.wizard.step6RowGender')} value={student?.gender} />
          <Step6ConfirmationRow label={t('enrollments.wizard.step6RowAge')} value={age ? t('enrollments.wizard.step6YearsOld', { age }) : t('enrollments.wizard.step6Unknown')} />
          <Step6ConfirmationRow label={t('enrollments.wizard.step6RowFather')} value={student?.fatherName} />
        </Step6ConfirmationSection>

        <Step6ConfirmationSection icon={BookOpen} title={t('enrollments.wizard.step6SectionSession')}>
          <Step6ConfirmationRow label={t('enrollments.detail.session')} value={session?.name} />
          <Step6ConfirmationRow label={t('enrollments.wizard.step6RowType')} value={session?.type} />
          <Step6ConfirmationRow label={t('enrollments.wizard.step6RowStarts')} value={session?.startDate ? formatDate(session.startDate) : undefined} />
          <Step6ConfirmationRow label={t('enrollments.wizard.step6RowEnds')} value={session?.endDate ? formatDate(session.endDate) : undefined} />
        </Step6ConfirmationSection>

        <Step6ConfirmationSection icon={Layers} title={t('enrollments.wizard.step6SectionClass')}>
          <Step6ConfirmationRow label={t('enrollments.detail.class')} value={classInfo?.name} />
          <Step6ConfirmationRow label={t('enrollments.wizard.step6RowTeacher')} value={classInfo?.facultyName} />
          {classInfo?.room && <Step6ConfirmationRow label={t('enrollments.wizard.step6RowRoom')} value={classInfo.room} />}
          <Step6ConfirmationRow
            label={t('enrollments.wizard.step6RowAgeRange')}
            value={classInfo ? t('enrollments.wizard.step6AgeRangeValue', {
              min: classInfo.minAge ?? (classInfo as Class & { ageMin?: number }).ageMin ?? 0,
              max: classInfo.maxAge ?? (classInfo as Class & { ageMax?: number }).ageMax ?? 0,
            }) : '—'}
          />

        </Step6ConfirmationSection>

        <Step6ConfirmationSection icon={DollarSign} title={t('enrollments.wizard.step6SectionFee')}>
          <Step6ConfirmationRow label={t('enrollments.detail.baseFee')} value={session ? formatCurrency(session.baseFee) : '—'} />
          <Step6ConfirmationRow label={feeResult?.label || t('enrollments.detail.discount')} value={feeResult && feeResult.pct > 0 ? `– ${formatCurrency(feeResult.discountAmt)} (${feeResult.pct}%)` : t('enrollments.detail.none')} />
          <div className="flex items-center justify-between py-2">
            <span className="text-xs font-bold text-foreground">{t('enrollments.detail.totalDue')}</span>
            <span className="text-sm font-bold text-primary">{formatCurrency(feeResult?.finalFee)}</span>
          </div>
        </Step6ConfirmationSection>
      </div>

      <Field id="enrollment-notes" label={t('enrollments.detail.notes')}>
        <Textarea
          id="enrollment-notes"
          name="notes"
          className="min-h-20"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder={t('enrollments.detail.notesPlaceholder')}
        />
      </Field>

      <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 space-y-1.5" role="note" aria-label={t('enrollments.wizard.step6NextAria')}>
        <p className="text-xs font-bold text-foreground">{t('enrollments.wizard.step6NextTitle')}</p>
        {[
          t('enrollments.wizard.step6NextCreated'),
          t('enrollments.wizard.step6NextInvoice', { amount: formatCurrency(feeResult?.finalFee) || '—' }),
          t('enrollments.wizard.step6NextNotification'),
          t('enrollments.wizard.step6NextConfirmed'),
        ].map((item, index) => (
          <div key={`${index}-${item}`} className="flex items-start gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="w-3 h-3 text-primary flex-shrink-0 mt-0.5" aria-hidden="true" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
