import React, { useMemo } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { WizardStepIndicator, type WizardStepItem } from "@shared/ui";

interface SimpleTransactionWizardStepsProps {
  currentStep: number;
  onSelectStep: (stepNumber: number) => void;
}

export function SimpleTransactionWizardSteps({
  currentStep,
  onSelectStep,
}: SimpleTransactionWizardStepsProps) {
  const { t } = useTranslation();

  const steps = useMemo<WizardStepItem[]>(
    () => [
      { id: 1, label: t("accounting.journal.dashboard.wizard.stepSelect") },
      { id: 2, label: t("accounting.journal.dashboard.wizard.stepDetails") },
      { id: 3, label: t("accounting.journal.dashboard.wizard.stepReview") },
    ],
    [t],
  );

  return (
    <nav aria-label={t("accounting.journal.dashboard.wizard.stepsAria")}>
      <WizardStepIndicator
        steps={steps}
        current={currentStep}
        onStepClick={(step) => onSelectStep(Number(step.id))}
        isStepClickable={(_step, index) => currentStep > index + 1}
      />
    </nav>
  );
}
