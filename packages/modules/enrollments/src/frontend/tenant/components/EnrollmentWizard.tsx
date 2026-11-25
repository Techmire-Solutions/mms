import { translateValidationMessage } from "@mms/fe-core/forms/translateValidationMessage";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { m, AnimatePresence } from "framer-motion";
import { StepIndicator, type Step } from "./wizard/StepIndicator";
import { Step1SelectStudent } from "./wizard/Step1SelectStudent";
import { Step2SelectSession } from "./wizard/Step2SelectSession";
import { Step3Eligibility } from "./wizard/Step3Eligibility";
import { Step4ClassAssignment } from "./wizard/Step4ClassAssignment";
import { defaultSectionId, type SectionPlacement } from "./wizard/Step4SectionPlacement";
import { Step5FeeCalculation } from "./wizard/Step5FeeCalculation";
import { Step6Confirmation } from "./wizard/Step6Confirmation";
import { suggestClass, runFullEligibility, type CalculatedFee } from "../lib/enrollmentData";
import { type EnrollmentInsert } from "@mms/contracts";
import { resolveEnrollmentApiError } from "@mms/fe-core/forms/resolveEnrollmentApiError";
import { parseEnrollmentInsertPayload } from "../lib/enrollmentWizardParse";
import type { Student } from "@mms/contracts";
import type { Session, Class } from "@mms/contracts";
import { useEnrollmentWizardSessions } from "../hooks/useEnrollmentWizardSessions";
import { ErrorState } from "@mms/fe-core/components/ErrorState";
import { Alert } from "@mms/ui";
import { useEnrollmentConfig } from "../host/useEnrollmentConfig";
import { useTranslation } from "@mms/fe-core/i18n";
import { buildEnrollmentPayload } from "../lib/enrollmentWizardBuildPayload";
import { EnrollmentWizardSuccess } from "./EnrollmentWizardSuccess";
import { EnrollmentWizardFooter } from "./EnrollmentWizardFooter";
import { enrollmentWizardSteps } from "../lib/enrollmentWizardSteps";
import { canProceedEnrollmentStep } from "../lib/enrollmentWizardCanProceed";
export interface EnrollmentWizardProps {
  onComplete: (enrollment: EnrollmentInsert) => void | Promise<void>;
  onCancel: () => void;
  /** Reports draft presence so the hosting FormModal can guard an accidental close. */
  onDirtyChange?: (dirty: boolean) => void;
  onSubmittingChange?: (submitting: boolean) => void;
}

export const EnrollmentWizard = function EnrollmentWizard({
  onComplete,
  onCancel,
  onDirtyChange,
  onSubmittingChange,
}: EnrollmentWizardProps): React.JSX.Element {
  const { t } = useTranslation();
  const { sessions, sessionsQuery } = useEnrollmentWizardSessions();
  const [step, setStep] = useState<number>(0);
  const [student, setStudent] = useState<Student | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [classInfo, setClassInfoState] = useState<Class | null>(null);
  const [placement, setPlacement] = useState<SectionPlacement>({ sectionId: "", rollNo: "" });
  const setClassInfo = (next: Class | null) => {
    setClassInfoState(next);
    setPlacement({ sectionId: defaultSectionId(next), rollNo: "" });
    // The fee rules depend on the class: a previous calculation is stale after a change.
    setFeeResult(null);
  };
  const [feeResult, setFeeResult] = useState<CalculatedFee | null>(null);
  const [notes, setNotes] = useState<string>("");
  const [attempted, setAttempted] = useState(false);
  const [done, setDone] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [direction, setDirection] = useState<number>(1);
  const successCloseTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (successCloseTimerRef.current !== null) {
        window.clearTimeout(successCloseTimerRef.current);
      }
    },
    [],
  );

  const { fields } = useEnrollmentConfig();

  const steps: Step[] = useMemo(() => enrollmentWizardSteps(t), [t]);
  const notesRequired = Boolean(fields.notes?.required);
  const dirty = Boolean(
    student ||
    session ||
    classInfo ||
    placement.sectionId ||
    placement.rollNo.trim() ||
    notes.trim() ||
    step > 0,
  );
  React.useEffect(() => {
    onDirtyChange?.(dirty);
    onSubmittingChange?.(submitting);
  }, [dirty, onDirtyChange, submitting, onSubmittingChange]);
  const suggested = student && session ? suggestClass(student, session) : null;
  // Eligibility is deterministic per student/session; compute it once per change.
  const eligibilityChecks = useMemo(
    () => (student && session ? runFullEligibility(student, session, suggested, []) : []),
    [student, session, suggested],
  );
  const canNext = (): boolean =>
    canProceedEnrollmentStep({
      step,
      hasStudent: Boolean(student),
      hasSession: Boolean(session),
      eligibilityPassed: eligibilityChecks.every((check: any) => check.status !== "fail"),
      classInfo,
      placement,
      feeReady: Boolean(feeResult),
    });

  const notesError = notesRequired && attempted && !notes.trim();
  const canConfirm = (): boolean => !notesError;

  const go = (directionDelta: number) => {
    setAttempted(false);
    setDirection(directionDelta);
    setStep((currentStep) => currentStep + directionDelta);
  };

  const handleNext = () => {
    if (step === 1 && suggested) {
      setClassInfo(suggested);
    }
    go(1);
  };
  const handleSubmit = async () => {
    setAttempted(true);
    if (!student || !session || !feeResult || notesError || submitting) {
      if (!feeResult) setSubmitError(t("enrollments.wizard.feeNotReady"));
      return;
    }

    const payload = buildEnrollmentPayload({
      student,
      session,
      classInfo,
      feeResult,
      notes,
      placement,
    });
    const parsed = parseEnrollmentInsertPayload(payload, (message) =>
      translateValidationMessage(message, t),
    );
    if (!parsed.ok) {
      setSubmitError(parsed.message || t("enrollments.toast.saveFailed"));
      return;
    }

    setSubmitting(true);
    try {
      setSubmitError(null);
      await onComplete(parsed.data);
      setDone(true);
      successCloseTimerRef.current = window.setTimeout(() => onCancel(), 900);
    } catch (error) {
      // Keep the wizard open and show the mapped reason inline as well as in the parent toast.
      setSubmitError(resolveEnrollmentApiError(error, t) ?? t("enrollments.toast.saveFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  if (sessionsQuery.isLoading) {
    return (
      <p role="status" aria-live="polite" className="p-4 text-sm text-muted-foreground">
        {t("common.loading")}
      </p>
    );
  }

  if (sessionsQuery.isError) {
    return (
      <ErrorState
        title={t("enrollments.wizard.sessionsLoadFailed")}
        onRetry={() => void sessionsQuery.refetch()}
      />
    );
  }

  if (done) {
    return <EnrollmentWizardSuccess t={t} student={student} session={session} />;
  }
  return (
    <article className="space-y-6" aria-label={t("enrollments.wizard.formAria")}>
      <div className="overflow-x-auto pb-1">
        <StepIndicator steps={steps} current={step} />
      </div>
      <form
        id="enrollment-wizard-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (step < steps.length - 1) {
            if (canNext()) handleNext();
          } else {
            if (canConfirm() && !submitting) void handleSubmit();
          }
        }}
      >
        <AnimatePresence mode="wait" custom={direction}>
          <m.div
            key={step}
            custom={direction}
            initial={{ opacity: 0, x: direction * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -24 }}
            transition={{ duration: 0.22 }}
          >
            {step === 0 && (
              <Step1SelectStudent value={student} onChange={setStudent} sessions={sessions} />
            )}
            {step === 1 && (
              <Step2SelectSession
                value={session}
                onChange={(selectedSession) => {
                  setSession(selectedSession);
                  setClassInfo(null);
                  setFeeResult(null);
                }}
                sessions={sessions}
              />
            )}
            {step === 2 && student && session && (
              <Step3Eligibility student={student} session={session} suggestedClass={suggested} />
            )}
            {step === 3 && session && (
              <Step4ClassAssignment
                session={session}
                student={student}
                suggestedClass={suggested}
                value={classInfo}
                onChange={setClassInfo}
                placement={placement}
                onPlacementChange={setPlacement}
              />
            )}
            {step === 4 && student && session && (
              <Step5FeeCalculation
                student={student}
                session={session}
                classInfo={classInfo}
                feeResult={feeResult}
                onFeeResult={setFeeResult}
              />
            )}
            {step === 5 && (
              <Step6Confirmation
                student={student}
                session={session}
                classInfo={classInfo}
                feeResult={feeResult}
                notes={notes}
                onNotesChange={setNotes}
                notesRequired={notesRequired}
                notesError={notesError ? t("enrollments.wizard.notesRequired") : undefined}
              />
            )}
          </m.div>
        </AnimatePresence>
      </form>
      {submitError ? (
        <Alert
          tone="destructive"
          role="alert"
          title={t("enrollments.wizard.submitFailed")}
          description={submitError}
        />
      ) : null}
      <EnrollmentWizardFooter
        t={t}
        step={step}
        steps={steps}
        canNext={canNext()}
        canConfirm={canConfirm()}
        submitting={submitting}
        form="enrollment-wizard-form"
        onCancel={onCancel}
        onPrevious={() => go(-1)}
        onNext={handleNext}
        onSubmit={handleSubmit}
      />
    </article>
  );
};
