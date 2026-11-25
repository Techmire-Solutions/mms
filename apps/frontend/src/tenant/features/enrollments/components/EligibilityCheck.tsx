import React, { useState } from "react";
import { getInitials } from "@mms/contracts";
import { CheckCircle2, XCircle } from "lucide-react";
import { calcAge } from "@/lib/data/studentsData";
import { type CheckResult, runFullEligibility, suggestClass } from "@/lib/data/enrollmentData";
import { Field } from "@/components/app/FormField";
import { FormSelect } from "@/components/app/FormSelect";
import { Alert } from "@/components/app/Alert";
import { useStudentsByIds } from "@/tenant/hooks/collections/students";
import { RegistryPersonSelect } from "@/tenant/components/selectors/RegistryPersonSelect";
import { useSessionsCollection } from "@/tenant/hooks/collections/sessions";
import { useTranslation } from "@/hooks/useTranslation";
import { EligibilityCheckRows } from "./EligibilityCheckRows";

export function EligibilityCheck(): React.JSX.Element {
  const { t } = useTranslation();
  const sessions = useSessionsCollection();
  const [studentId, setStudentId] = useState<string>("");
  const [sessionId, setSessionId] = useState<string>("");

  const { data: resolvedStudents = [] } = useStudentsByIds(studentId ? [studentId] : []);
  const student = resolvedStudents[0];
  const session = sessions.find((sessionOption) => sessionOption.id === sessionId);
  const suggested = student && session ? suggestClass(student, session) : null;

  const checks = (() => {
    if (!student || !session) return [];
    return runFullEligibility(student, session, suggested, []);
  })() as CheckResult[];

  const failCount = checks.filter((check) => check.status === "fail").length;
  const warnCount = checks.filter((check) => check.status === "warn").length;
  const passCount = checks.filter((check) => check.status === "pass").length;

  return (
    <article className="max-w-2xl space-y-5" aria-labelledby="eligibility-title">
      <div>
        <h3 id="eligibility-title" className="text-base font-bold text-foreground">
          {t("enrollments.eligibility.title")}
        </h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t("enrollments.eligibility.description")}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <RegistryPersonSelect
          kind="student"
          id="select-student"
          label={t("enrollments.eligibility.student")}
          value={studentId}
          onChange={setStudentId}
        />
        <Field id="select-session" label={t("enrollments.eligibility.session")}>
          <FormSelect
            id="select-session"
            name="sessionId"
            value={sessionId}
            onChange={setSessionId}
            options={sessions.map((sessionOption) => ({
              value: sessionOption.id,
              label: sessionOption.name,
            }))}
            placeholder={t("enrollments.eligibility.selectSession")}
          />
        </Field>
      </div>

      {student && (
        <section
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-muted border border-border"
          aria-label={t("enrollments.eligibility.studentPreview")}
        >
          <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-primary">{getInitials(student.name)}</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-foreground">{student.name}</p>
              {student.grNumber && (
                <span className="bg-primary/5 text-primary text-xs px-1.5 py-0.5 rounded border border-primary/10 font-bold uppercase">
                  {t("enrollments.detail.grNumber")}: {student.grNumber}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("enrollments.eligibility.studentMeta", {
                age: calcAge(student.dob) ?? "?",
                gender: student.gender || "—",
                city: student.city || t("enrollments.eligibility.noCity"),
              })}
            </p>
          </div>
        </section>
      )}

      {student && session && (
        <>
          <div
            className="flex items-center gap-3 flex-wrap"
            role="status"
            aria-label={t("enrollments.eligibility.summary")}
          >
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-success/10 border border-success/30">
              <CheckCircle2 className="w-3.5 h-3.5 text-success" aria-hidden="true" />
              <span className="text-xs font-bold text-success">
                {t("enrollments.eligibility.passed", { count: passCount })}
              </span>
            </div>
            {failCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-destructive/10 border border-destructive/30">
                <XCircle className="w-3.5 h-3.5 text-destructive" aria-hidden="true" />
                <span className="text-xs font-bold text-destructive">
                  {t("enrollments.eligibility.failed", { count: failCount })}
                </span>
              </div>
            )}
            {warnCount > 0 && (
              <Alert
                density="compact"
                className="rounded-xl py-1.5"
                description={t("enrollments.eligibility.warnings", { count: warnCount })}
              />
            )}
          </div>

          <EligibilityCheckRows checks={checks} ariaLabel={t("enrollments.eligibility.details")} />
        </>
      )}
    </article>
  );
}
