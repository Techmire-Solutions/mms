import React from "react";
import type { Dispatch, SetStateAction } from "react";
import type { OnboardingData } from "@/platform/features/onboarding/onboardingWizardTypes";
import { useCreateMadrasaController } from "@/platform/features/onboarding/steps/useCreateMadrasaController";
import { CreateMadrasaIdentitySection } from "@/platform/features/onboarding/steps/CreateMadrasaIdentitySection";
import { CreateMadrasaIndustrySection } from "@/platform/features/onboarding/steps/CreateMadrasaIndustrySection";

interface OrganizationDetailsStepProps {
  data: OnboardingData;
  onChange: Dispatch<SetStateAction<OnboardingData>>;
}

/** Step 1: organization name, subdomain, and industry profile. */
export default function OrganizationDetailsStep({
  data,
  onChange,
}: OrganizationDetailsStepProps): React.ReactElement {
  const controller = useCreateMadrasaController(data, onChange);
  return (
    <div className="space-y-6">
      <CreateMadrasaIdentitySection controller={controller} />
      <CreateMadrasaIndustrySection controller={controller} />
    </div>
  );
}
