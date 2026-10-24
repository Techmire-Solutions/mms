/**
 * @file CompleteStep.tsx
 * @description Onboarding step 5 — review summary before workspace create.
 */

import React from "react";
import type { Dispatch, SetStateAction } from "react";
import { ClipboardCheck } from "lucide-react";
import { SYSTEM_MODULES } from "@mms/shared";
import { Field, Input, SectionCard } from "@shared/ui";
import { useTranslation } from "@/hooks/useTranslation";
import type { OnboardingData } from "@/platform/pages/onboarding/onboardingWizardTypes";

interface CompleteStepProps {
  data: OnboardingData;
  onChange: Dispatch<SetStateAction<OnboardingData>>;
}

export default function CompleteStep({ data, onChange }: CompleteStepProps): React.JSX.Element {
  const { t } = useTranslation();
  const moduleCount = data.modules.filter((id) =>
    SYSTEM_MODULES.some((module) => module.id === id),
  ).length;

  return (
    <SectionCard
      title={t("onboarding.completeTitle")}
      subtitle={t("onboarding.completeSubtitle")}
      icon={ClipboardCheck}
    >
      <dl className="space-y-2 text-sm">
        <SummaryRow label={t("branding.madrasaName")} value={data.name} />
        <SummaryRow label={t("onboarding.madrasa.subdomainLabel")} value={data.subdomain} />
        <SummaryRow
          label={t("organization.industryProfile")}
          value={t(`organization.industry.${data.industryType}` as never)}
        />
        <SummaryRow
          label={t("platform.modulesTitle")}
          value={t("onboarding.completeModuleCount", { count: moduleCount })}
        />
        <SummaryRow
          label={t("onboarding.structureTitle")}
          value={t("onboarding.structureStartBlank")}
        />
        <SummaryRow
          label={t("onboarding.stepAdminLabel")}
          value={`${data.firstName} ${data.lastName}`.trim() || "—"}
        />
      </dl>

      <Field
        id="onboarding-platform-password"
        label={t("platform.confirmPlatformPassword")}
        required
      >
        <Input
          id="onboarding-platform-password"
          name="platformPassword"
          type="password"
          autoComplete="current-password"
          placeholder={t("platform.confirmPlatformPasswordHint")}
          value={data.currentPassword}
          onChange={(e) => onChange((prev) => ({ ...prev, currentPassword: e.target.value }))}
          className="h-11 text-sm"
        />
      </Field>
    </SectionCard>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-2">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-foreground font-medium text-end">{value}</dd>
    </div>
  );
}
