import React from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { type CheckResult, runFullEligibility } from "@/lib/data/enrollmentData";
import { type Student } from "@/lib/data/studentsData";
import { type Session, type Class } from "@/lib/data/sessionsData";
import { useTranslation } from "@mms/fe-core/i18n";
import { Alert } from "@mms/ui";
import { EligibilityCheckRows } from "@/tenant/features/enrollments/components/EligibilityCheckRows";

export interface Step3EligibilityProps {
  student: Student;
  session: Session;
  suggestedClass: Class | null;
}

export function Step3Eligibility({
  student,
  session,
  suggestedClass,
}: Step3EligibilityProps): React.JSX.Element {
  const { t } = useTranslation();
  const checks = (() =>
    runFullEligibility(student, session, suggestedClass, []))() as CheckResult[];

  const passCount = checks.filter((check) => check.status === "pass").length;
  const failCount = checks.filter((check) => check.status === "fail").length;
  const warnCount = checks.filter((check) => check.status === "warn").length;
  const canProceed = failCount === 0;

  return (
    <section className="space-y-4" aria-labelledby="step3-title">
      <div>
        <h3 id="step3-title" className="text-base font-bold text-foreground">
          {t("enrollments.wizard.step3Title")}
        </h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t("enrollments.wizard.step3Desc", {
            student: student.name || "—",
            session: session.name || "—",
          })}
        </p>
      </div>

      {/* Summary bar */}
      <div
        className="flex items-center gap-3 flex-wrap"
        role="status"
        aria-label={t("enrollments.wizard.step3SummaryAria")}
      >
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-success/10 border border-success/30">
          <CheckCircle2 className="w-3.5 h-3.5 text-success" aria-hidden="true" />
          <span className="text-xs font-bold text-success">
            {t("enrollments.wizard.step3Passed", { count: passCount })}
          </span>
        </div>
        {failCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-destructive/10 border border-destructive/30">
            <XCircle className="w-3.5 h-3.5 text-destructive" aria-hidden="true" />
            <span className="text-xs font-bold text-destructive">
              {t("enrollments.wizard.step3Failed", { count: failCount })}
            </span>
          </div>
        )}
        {warnCount > 0 && (
          <Alert
            density="compact"
            className="rounded-xl py-1.5"
            description={t("enrollments.wizard.step3Warnings", { count: warnCount })}
          />
        )}
      </div>

      {/* Check rows */}
      <EligibilityCheckRows checks={checks} ariaLabel={t("enrollments.wizard.step3DetailsAria")} />

      {/* Result banner */}
      {canProceed ? (
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-xl bg-success/10 border border-success/30 text-success text-sm font-semibold"
          role="status"
        >
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          {t("enrollments.wizard.step3Eligible")}
        </div>
      ) : (
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm font-semibold"
          role="alert"
        >
          <XCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          {t("enrollments.wizard.step3FailedBanner", { count: failCount })}
        </div>
      )}
    </section>
  );
}
