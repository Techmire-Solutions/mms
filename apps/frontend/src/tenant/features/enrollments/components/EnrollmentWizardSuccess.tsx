import React from "react";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { Student } from "@/lib/data/studentsData";
import type { Session } from "@/lib/data/sessionsData";

export interface EnrollmentWizardSuccessProps {
  t: TranslationFunction;
  student: Student | null;
  session: Session | null;
}

export function EnrollmentWizardSuccess({
  t,
  student,
  session,
}: EnrollmentWizardSuccessProps): React.JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-16 text-center px-6"
      role="status"
      aria-live="polite"
    >
      <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center mb-4">
        <CheckCircle2 className="w-8 h-8 text-success" aria-hidden="true" />
      </div>
      <p className="text-lg font-bold text-foreground">{t("enrollments.wizard.submittedTitle")}</p>
      <p className="text-sm text-muted-foreground mt-1">
        {t("enrollments.wizard.submittedSubtitle", {
          student: student?.name || "",
          session: session?.name || "",
        })}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">
        {t("enrollments.wizard.submittedHint")}
      </p>
    </motion.div>
  );
}
