import React from "react";
import { MapPin } from "lucide-react";
import type { BrandingSettings } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/app/FormField";
import { SectionCard } from "@/components/app/SectionCard";
import { FORM_INPUT, SETUP_SECTION_CARD_CLASS } from "@/components/ui/formStyles";
import type { InstitutionSetupFieldErrors } from "./InstitutionSetupFormSections";

export interface InstitutionSetupAddressSectionProps {
  data: BrandingSettings;
  errors: InstitutionSetupFieldErrors;
  updateField: <K extends keyof BrandingSettings>(field: K, value: BrandingSettings[K]) => void;
}

export function InstitutionSetupAddressSection({
  data,
  errors,
  updateField,
}: InstitutionSetupAddressSectionProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <SectionCard
      title={t("institutionSetup.addressSection")}
      subtitle={t("institutionSetup.addressSectionDesc")}
      icon={MapPin}
      className={SETUP_SECTION_CARD_CLASS}
    >
      <div className="space-y-4">
        <Field
          id="setup-addressLine1"
          label={t("branding.addressLine1")}
          required
          error={errors.addressLine1}
        >
          <Input
            id="setup-addressLine1"
            name="addressLine1"
            className={FORM_INPUT}
            value={data.addressLine1 || ""}
            onChange={(e) => updateField("addressLine1", e.target.value)}
            placeholder={t("branding.addressLine1Placeholder")}
          />
        </Field>

        <Field id="setup-addressLine2" label={t("branding.addressLine2")}>
          <Input
            id="setup-addressLine2"
            name="addressLine2"
            className={FORM_INPUT}
            value={data.addressLine2 || ""}
            onChange={(e) => updateField("addressLine2", e.target.value)}
            placeholder={t("branding.addressLine2Placeholder")}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="setup-city" label={t("branding.city")} required error={errors.city}>
            <Input
              id="setup-city"
              name="city"
              className={FORM_INPUT}
              value={data.city || ""}
              onChange={(e) => updateField("city", e.target.value)}
              placeholder={t("branding.cityPlaceholder")}
            />
          </Field>

          <Field id="setup-region" label={t("branding.region")}>
            <Input
              id="setup-region"
              name="region"
              className={FORM_INPUT}
              value={data.region || ""}
              onChange={(e) => updateField("region", e.target.value)}
              placeholder={t("branding.regionPlaceholder")}
            />
          </Field>

          <Field
            id="setup-postalCode"
            label={t("branding.postalCode")}
            required
            error={errors.postalCode}
          >
            <Input
              id="setup-postalCode"
              name="postalCode"
              className={FORM_INPUT}
              value={data.postalCode || ""}
              onChange={(e) => updateField("postalCode", e.target.value)}
              placeholder={t("branding.postalCodePlaceholder")}
            />
          </Field>

          <Field id="setup-country" label={t("branding.country")} required error={errors.country}>
            <Input
              id="setup-country"
              name="country"
              className={FORM_INPUT}
              value={data.country || ""}
              onChange={(e) => updateField("country", e.target.value)}
              placeholder={t("branding.countryPlaceholder")}
            />
          </Field>
        </div>
      </div>
      <p className="text-xs text-muted-foreground pt-1">
        {t("branding.locationGlobalDefaultsNote")}
      </p>
    </SectionCard>
  );
}
