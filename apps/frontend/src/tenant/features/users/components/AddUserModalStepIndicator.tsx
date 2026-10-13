import React from "react";
import { Lock, ShieldCheck, User, type LucideIcon } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { WizardStepIndicator, type WizardStepItem } from "@/components/app/WizardStepIndicator";

interface AddUserModalStepDefinition {
  id: number;
  labelKey: "users.addStepContact" | "users.addStepRoles" | "users.addStepAccount";
  icon: LucideIcon;
}

export const ADD_USER_MODAL_STEP_DEFS: AddUserModalStepDefinition[] = [
  { id: 1, labelKey: "users.addStepContact", icon: User },
  { id: 2, labelKey: "users.addStepRoles", icon: ShieldCheck },
  { id: 3, labelKey: "users.addStepAccount", icon: Lock },
];

interface StepIndicatorProps {
  step: number;
}

export function StepIndicator({ step }: StepIndicatorProps): JSX.Element {
  const { t } = useTranslation();

  const steps: WizardStepItem[] = ADD_USER_MODAL_STEP_DEFS.map((def) => ({
    id: def.id,
    label: t(def.labelKey),
    icon: def.icon,
  }));

  return (
    <WizardStepIndicator
      steps={steps}
      current={step}
      className="mb-6"
      ariaLabel={t("users.stepIndicatorAria")}
    />
  );
}
