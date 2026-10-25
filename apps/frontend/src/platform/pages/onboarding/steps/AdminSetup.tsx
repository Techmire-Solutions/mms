import React from "react";
import type { Dispatch, SetStateAction } from "react";
import type { OnboardingData } from "@/platform/pages/onboarding/OnboardingWizard";
import { useTranslation } from "@/hooks/useTranslation";
import { Mail } from "lucide-react";
import { Alert, Checkbox, Field, Input } from "@shared/ui";
import { AuthEmailField } from "@/components/entry";

/** The subset of onboarding data used by this step. */
export interface AdminSetupData {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  agreedTerms?: boolean;
}

interface AdminSetupProps {
  data: OnboardingData;
  onChange: Dispatch<SetStateAction<OnboardingData>>;
}

/**
 * AdminSetup step component for onboarding.
 */
export default function AdminSetup({ data, onChange }: AdminSetupProps) {
  const { t } = useTranslation();

  const update = (field: keyof OnboardingData, fieldValue: unknown) => {
    onChange((prev) => ({ ...prev, [field]: fieldValue }) as OnboardingData);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field id="firstName" label={t("onboarding.admin.firstName")} required>
          <Input
            id="firstName"
            name="firstName"
            type="text"
            autoComplete="given-name"
            autoFocus
            required
            value={data.firstName || ""}
            onChange={(event) => update("firstName", event.target.value)}
            placeholder={t("onboarding.admin.firstNamePlaceholder")}
            className="h-11"
          />
        </Field>
        <Field id="lastName" label={t("onboarding.admin.lastName")} required>
          <Input
            id="lastName"
            name="lastName"
            type="text"
            autoComplete="family-name"
            required
            value={data.lastName || ""}
            onChange={(event) => update("lastName", event.target.value)}
            placeholder={t("onboarding.admin.lastNamePlaceholder")}
            className="h-11"
          />
        </Field>
      </div>

      <AuthEmailField
        id="email"
        label={t("onboarding.admin.email")}
        value={data.email || ""}
        placeholder={t("onboarding.admin.emailPlaceholder")}
        onChange={(value) => update("email", value)}
      />

      <Alert icon={Mail} tone="info" description={t("onboarding.admin.passwordEmailNotice")} />

      <div className="flex min-h-11 items-start gap-2.5 rounded-lg pt-1 select-none">
        <Checkbox
          id="terms"
          name="terms"
          checked={data.agreedTerms || false}
          onCheckedChange={(checked) => update("agreedTerms", checked === true)}
          className="mt-0.5 cursor-pointer"
        />
        <label
          htmlFor="terms"
          className="cursor-pointer text-xs leading-relaxed text-muted-foreground flex-1"
        >
          {t("onboarding.agreeTerms")}
        </label>
      </div>
    </div>
  );
}
