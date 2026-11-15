import { BookOpen, CheckCircle2, ClipboardCheck, DollarSign, Layers, User } from "lucide-react";
import type { AppTranslationKey } from "@mms/shared";
import type { Step } from "@/tenant/features/enrollments/components/wizard/StepIndicator";

/** Step chrome for the enrollment wizard (labels resolve through the caller's `t`). */
export function enrollmentWizardSteps(t: (key: AppTranslationKey) => string): Step[] {
  return [
    { id: "student", label: t("enrollments.columns.student"), icon: User },
    { id: "session", label: t("enrollments.columns.session"), icon: BookOpen },
    { id: "eligibility", label: t("enrollments.eligibility"), icon: CheckCircle2 },
    { id: "class", label: t("enrollments.columns.class"), icon: Layers },
    { id: "fee", label: t("enrollments.columns.finalFee"), icon: DollarSign },
    { id: "confirm", label: t("enrollments.new"), icon: ClipboardCheck },
  ];
}
