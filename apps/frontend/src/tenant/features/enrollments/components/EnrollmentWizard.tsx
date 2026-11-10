import React, { useMemo, useState } from "react";
import { m, AnimatePresence } from "framer-motion";
import { User, BookOpen, CheckCircle2, Layers, DollarSign, ClipboardCheck } from "lucide-react";
import {
  StepIndicator,
  type Step,
} from "@/tenant/features/enrollments/components/wizard/StepIndicator";
import { Step1SelectStudent } from "@/tenant/features/enrollments/components/wizard/Step1SelectStudent";
import { Step2SelectSession } from "@/tenant/features/enrollments/components/wizard/Step2SelectSession";
import { Step3Eligibility } from "@/tenant/features/enrollments/components/wizard/Step3Eligibility";
import { Step4ClassAssignment } from "@/tenant/features/enrollments/components/wizard/Step4ClassAssignment";
import {
  defaultSectionId,
  type SectionPlacement,
} from "@/tenant/features/enrollments/components/wizard/Step4SectionPlacement";
import { Step5FeeCalculation } from "@/tenant/features/enrollments/components/wizard/Step5FeeCalculation";
import { Step6Confirmation } from "@/tenant/features/enrollments/components/wizard/Step6Confirmation";
import { suggestClass, runFullEligibility, type CalculatedFee } from "@/lib/data/enrollmentData";
import type { EnrollmentInsert } from "@mms/shared";
import { type Student } from "@/lib/data/studentsData";
import { type Session, type Class } from "@/lib/data/sessionsData";
import { useSessions } from "@/tenant/hooks/collections/sessions";
import { ErrorState } from "@/components/app/ErrorState";
import { Alert } from "@/components/app/Alert";
import { useEnrollmentConfig } from "@/hooks/useStandardModuleConfig";
import { useTranslation } from "@/hooks/useTranslation";
import { buildEnrollmentPayload } from "@/tenant/features/enrollments/lib/enrollmentWizardBuildPayload";
import { EnrollmentWizardSuccess } from "@/tenant/features/enrollments/components/EnrollmentWizardSuccess";
import { EnrollmentWizardFooter } from "@/tenant/features/enrollments/components/EnrollmentWizardFooter";

export interface EnrollmentWizardProps {
  onComplete: (enrollment: EnrollmentInsert) => void | Promise<void>;
  onCancel: () => void;
}

export const EnrollmentWizard = function EnrollmentWizard({
  onComplete,
  onCancel,
}: EnrollmentWizardProps): React.JSX.Element {
  const { t } = useTranslation();
  const sessionsQuery = useSessions();
  const sessions = useMemo(() => {
    const body = sessionsQuery.data?.status === 200 ? sessionsQuery.data.body : null;
    if (Array.isArray(body)) return body as Session[];
    if (body && typeof body === "object" && "sessions" in body && Array.isArray(body.sessions)) {
      return body.sessions as Session[];
    }
    return [] as Session[];
  }, [sessionsQuery.data]);
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
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});
  const [done, setDone] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [direction, setDirection] = useState<number>(1);

  const { fields, customFields } = useEnrollmentConfig();

  const steps: Step[] = useMemo(
    () => [
      { id: "student", label: t("enrollments.columns.student"), icon: User },
      { id: "session", label: t("enrollments.columns.session"), icon: BookOpen },
      { id: "eligibility", label: t("enrollments.eligibility"), icon: CheckCircle2 },
      { id: "class", label: t("enrollments.columns.class"), icon: Layers },
      { id: "fee", label: t("enrollments.columns.finalFee"), icon: DollarSign },
      { id: "confirm", label: t("enrollments.new"), icon: ClipboardCheck },
    ],
    [t],
  );

  const suggested = student && session ? suggestClass(student, session) : null;

  // Eligibility is deterministic for the selected student/session: compute it once per
  // change instead of re-running every rule on every render for the footer disabled state.
  const eligibilityChecks = useMemo(
    () => (student && session ? runFullEligibility(student, session, suggested, []) : []),
    [student, session, suggested],
  );

  const canNext = (): boolean => {
    if (step === 0) return !!student;
    if (step === 1) return !!session;
    if (step === 2) return eligibilityChecks.every((check) => check.status !== "fail");
    if (step === 3) {
      if (!classInfo) return false;
      const sections = classInfo.sections ?? [];
      if (sections.length > 0) {
        const selectedSection = sections.find((section) => section.id === placement.sectionId);
        if (!selectedSection) return false;
      }
      return true;
    }
    if (step === 4) return !!feeResult;
    return true;
  };

  const canConfirm = (): boolean => {
    if (fields.notes?.required && !notes.trim()) return false;
    // Legacy custom-field truthiness check (settings.customFields)
    const legacyOk = customFields.every(
      (customField) => !customField.required || Boolean(customFieldValues[customField.id]),
    );
    return legacyOk;
  };

  const go = (directionDelta: number) => {
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
    if (!student || !session || !feeResult || submitting) return;

    const enrollment = buildEnrollmentPayload({
      student,
      session,
      classInfo,
      feeResult,
      notes,
      customFieldValues,
      placement,
    });

    setSubmitting(true);
    try {
      setSubmitError(null);
      await onComplete(enrollment);
      setDone(true);
      window.setTimeout(() => onCancel(), 900);
    } catch (error) {
      // Keep the wizard open and show the reason inline as well as in the parent toast.
      setSubmitError(error instanceof Error ? error.message : t("enrollments.toast.saveFailed"));
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
                customFieldValues={customFieldValues}
                onCustomFieldChange={(id, value) =>
                  setCustomFieldValues((previousValues) => ({ ...previousValues, [id]: value }))
                }
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
