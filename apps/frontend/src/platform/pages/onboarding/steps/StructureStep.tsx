/**
 * @file StructureStep.tsx
 * @description Onboarding step 3 — confirm blank workspace setup (roles advisory).
 */

import React from "react";
import type { Dispatch, SetStateAction } from "react";
import { Building2, Check } from "lucide-react";
import { getRecommendedRolesForIndustry } from "@mms/shared";
import { SectionCard } from "@shared/ui";
import { useTranslation } from "@/hooks/useTranslation";
import type { OnboardingData } from "@/platform/pages/onboarding/onboardingWizardTypes";

interface StructureStepProps {
  data: OnboardingData;
  onChange: Dispatch<SetStateAction<OnboardingData>>;
}

export default function StructureStep({ data }: StructureStepProps): React.JSX.Element {
  const { t } = useTranslation();
  const roles = getRecommendedRolesForIndustry(data.industryType);

  return (
    <SectionCard
      title={t("onboarding.structureTitle")}
      subtitle={t("onboarding.structureSubtitle")}
      icon={Building2}
    >
      <div className="space-y-4">
        <div
          role="radio"
          tabIndex={0}
          aria-checked
          className="min-h-11 w-full text-start rounded-lg border border-primary bg-primary/5 p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-foreground">
                {t("onboarding.structureStartBlank")}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("onboarding.structureStartBlankDesc")}
              </p>
            </div>
            <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden />
          </div>
        </div>

        {roles.length > 0 ? (
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs space-y-1.5">
            <p className="text-muted-foreground">
              {t("onboarding.structureRecommendedRolesAdvisory", {
                roles: roles.join(", "),
              })}
            </p>
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}
