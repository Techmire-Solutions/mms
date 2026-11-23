import React from "react";
import WizardLayout from "@/platform/features/onboarding/components/WizardLayout";
import { OnboardingWizardFooter } from "@/platform/features/onboarding/OnboardingWizardFooter";
import { useOnboardingWizardController } from "@/platform/features/onboarding/useOnboardingWizardController";

export type { OnboardingData } from "@/platform/features/onboarding/onboardingWizardTypes";

/** Platform-protected wizard to provision a new madrasa workspace. */
export default function OnboardingWizard(): React.JSX.Element {
  const {
    t,
    step,
    handleBack,
    data,
    setData,
    loading,
    submitError,
    wizardSteps,
    currentStep,
    isLastStep,
    handleNext,
    showSignInLink,
  } = useOnboardingWizardController();

  const StepComponent = currentStep.component;

  return (
    <WizardLayout
      currentStep={step}
      steps={wizardSteps}
      title={t(currentStep.titleKey)}
      subtitle={t(currentStep.subtitleKey)}
    >
      <form
        id="onboarding-wizard-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          handleNext();
        }}
      >
        <StepComponent data={data} onChange={setData} />
      </form>

      <OnboardingWizardFooter
        t={t}
        step={step}
        loading={loading}
        submitError={submitError}
        showSignInLink={showSignInLink}
        conflictSubdomain={data.subdomain}
        isLastStep={isLastStep}
        onBack={handleBack}
        onNext={handleNext}
      />
    </WizardLayout>
  );
}
