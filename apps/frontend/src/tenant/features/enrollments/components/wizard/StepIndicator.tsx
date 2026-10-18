import React from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { WizardStepIndicator, type WizardStepItem } from "@/components/app/WizardStepIndicator";

export interface Step extends WizardStepItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
}

export interface StepIndicatorProps {
  steps: Step[];
  current: number;
}

/**
 * Renders the visual step status elements for the wizard context.
 *
 * @param props - Component props.
 * @param props.steps - List of wizard steps configured.
 * @param props.current - The active step index.
 * @returns StepIndicator layout.
 */
export function StepIndicator({ steps, current }: StepIndicatorProps): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <WizardStepIndicator
      steps={steps}
      current={current}
      ariaLabel={t("enrollments.wizard.stepsAria")}
      stepStateLabels={{
        completed: t("enrollments.wizard.stepCompleted"),
        current: t("enrollments.wizard.stepCurrent"),
        upcoming: t("enrollments.wizard.stepUpcoming"),
      }}
    />
  );
}
