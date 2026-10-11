import React, { useMemo } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { WizardStepIndicator, type WizardStepItem } from "@/components/ui/WizardStepIndicator";

interface WakalaStepProgressBarProps {
  step: 1 | 2 | 3;
  onSetStep: (step: 1 | 2 | 3) => void;
  validateStep1: () => boolean;
  validateStep2: () => boolean;
}

export function WakalaStepProgressBar({
  step,
  onSetStep,
  validateStep1,
  validateStep2,
}: WakalaStepProgressBarProps): React.JSX.Element {
  const { t } = useTranslation();

  const steps = useMemo<WizardStepItem[]>(
    () => [
      { id: 1, label: t("obligations.wakala.stage1") },
      { id: 2, label: t("obligations.wakala.stage2") },
      { id: 3, label: t("obligations.wakala.stage3") },
    ],
    [t],
  );

  const handleStepClick = (_stepItem: WizardStepItem, index: number) => {
    const targetStep = (index + 1) as 1 | 2 | 3;
    if (targetStep === 1) {
      onSetStep(1);
    } else if (targetStep === 2) {
      if (validateStep1()) onSetStep(2);
    } else if (targetStep === 3) {
      if (validateStep1() && validateStep2()) onSetStep(3);
    }
  };

  return (
    <div className="rounded-xl bg-muted/40 p-2 border border-border/50">
      <WizardStepIndicator
        steps={steps}
        current={step}
        onStepClick={handleStepClick}
        // Validators mutate parent error state, so they must only run inside the
        // click handler — never during render (WizardStepIndicator calls this per step).
        isStepClickable={() => true}
        ariaLabel={t("obligations.wakala.listAria")}
      />
    </div>
  );
}
