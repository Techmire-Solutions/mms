import React from "react";
import { Building2, Mail } from "lucide-react";
import type { BrandingSettings } from "@mms/shared";

import { useTranslation } from "@/hooks/useTranslation";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/FormField";
import { SectionCard } from "@/components/ui/SectionCard";
import { FORM_INPUT, SETUP_SECTION_CARD_CLASS } from "@/components/ui/formStyles";
import { InstitutionSetupAddressSection } from "./InstitutionSetupAddressSection";

export interface InstitutionSetupFieldErrors {
  madrasaName?: string;
  tagline?: string;
  email?: string;
  phone?: string;
  addressLine1?: string;
  city?: string;
  country?: string;
  postalCode?: string;
}

export interface InstitutionSetupFormSectionProps {
  data: BrandingSettings;
  errors: InstitutionSetupFieldErrors;
  updateField: <K extends keyof BrandingSettings>(field: K, value: BrandingSettings[K]) => void;
}

/** Identity / Official Contact / Campus Address cards for the first-run setup wizard. */
export function InstitutionSetupFormSections({
  data,
  errors,
  updateField,
}: InstitutionSetupFormSectionProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      {/* 1. Identity */}
      <SectionCard
        title={t("institutionSetup.identitySection")}
        subtitle={t("institutionSetup.identitySectionDesc")}
        icon={Building2}
        className={SETUP_SECTION_CARD_CLASS}
      >
        <div className="space-y-4">
          <Field
            id="setup-madrasaName"
            label={t("branding.madrasaName")}
            required
            error={errors.madrasaName}
            hint={!errors.madrasaName ? t("branding.madrasaNameHint") : undefined}
          >
            <Input
              id="setup-madrasaName"
              name="madrasaName"
              className={FORM_INPUT}
              value={data.madrasaName}
              onChange={(e) => updateField("madrasaName", e.target.value)}
              placeholder={t("branding.madrasaNamePlaceholder")}
            />
          </Field>

          <Field id="setup-tagline" label={t("branding.tagline")} required error={errors.tagline}>
            <Input
              id="setup-tagline"
              name="tagline"
              className={FORM_INPUT}
              value={data.tagline}
              onChange={(e) => updateField("tagline", e.target.value)}
              placeholder={t("institutionSetup.taglinePlaceholder")}
            />
          </Field>
        </div>
      </SectionCard>

      {/* 2. Official Contact */}
      <SectionCard
        title={t("institutionSetup.contactSection")}
        subtitle={t("institutionSetup.contactSectionDesc")}
        icon={Mail}
        className={SETUP_SECTION_CARD_CLASS}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="setup-email" label={t("branding.email")} required error={errors.email}>
            <Input
              id="setup-email"
              name="email"
              type="email"
              className={FORM_INPUT}
              value={data.email}
              onChange={(e) => updateField("email", e.target.value)}
              placeholder={t("branding.emailPlaceholder")}
            />
          </Field>

          <Field id="setup-phone" label={t("branding.phone")} required error={errors.phone}>
            <Input
              id="setup-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              className={FORM_INPUT}
              value={data.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              placeholder={t("branding.phonePlaceholder")}
            />
          </Field>

          <div className="sm:col-span-2">
            <Field id="setup-website" label={t("branding.website")}>
              <Input
                id="setup-website"
                name="website"
                type="url"
                className={FORM_INPUT}
                value={data.website}
                onChange={(e) => updateField("website", e.target.value)}
                placeholder="https://www.yourmadrasa.org"
              />
            </Field>
          </div>
        </div>
      </SectionCard>

      {/* 3. Campus Address */}
      <InstitutionSetupAddressSection data={data} errors={errors} updateField={updateField} />
    </div>
  );
}
