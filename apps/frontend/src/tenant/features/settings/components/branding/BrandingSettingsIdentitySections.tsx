import React from "react";
import { Mail, Phone, Globe, Type } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import { SectionCard } from "@/components/ui/SectionCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FieldHint,
  ImageUploadField,
  NAME_MAX,
  TAGLINE_MAX,
} from "@/components/branding/BrandingShared";
import { normalizePhoneInput, type BrandingSettings } from "@mms/shared";

import { LeadingIconInput } from "@/components/ui/LeadingIconInput";

interface BrandingSettingsProfileSectionProps {
  data: BrandingSettings;
  upd: <K extends keyof BrandingSettings>(key: K, value: BrandingSettings[K]) => void;
}

export function BrandingSettingsProfileSection({
  data,
  upd,
}: BrandingSettingsProfileSectionProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <SectionCard
      title={t("branding.profileTitle")}
      subtitle={t("branding.profileDesc")}
      icon={Type}
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="madrasaName">{t("branding.madrasaName")}</Label>
              <span className="text-xs text-muted-foreground" aria-live="polite">
                {data.madrasaName.length}/{NAME_MAX}
              </span>
            </div>
            <Input
              id="madrasaName"
              name="madrasaName"
              value={data.madrasaName}
              maxLength={NAME_MAX}
              placeholder={t("branding.madrasaNamePlaceholder")}
              aria-describedby="madrasaName-hint"
              onChange={(event) => upd("madrasaName", event.target.value)}
            />
            <FieldHint id="madrasaName-hint">{t("branding.madrasaNameHint")}</FieldHint>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="tagline">{t("branding.tagline")}</Label>
              <span className="text-xs text-muted-foreground" aria-live="polite">
                {data.tagline.length}/{TAGLINE_MAX}
              </span>
            </div>
            <Input
              id="tagline"
              name="tagline"
              value={data.tagline}
              maxLength={TAGLINE_MAX}
              placeholder={t("branding.taglinePlaceholder")}
              aria-describedby="tagline-hint"
              onChange={(event) => upd("tagline", event.target.value)}
            />
            <FieldHint id="tagline-hint">{t("branding.taglineHint")}</FieldHint>
          </div>
        </div>
        <div className="space-y-6">
          <ImageUploadField
            id="branding-logo"
            label={t("branding.logo")}
            hint={t("branding.logoHint")}
            value={data.logoUrl}
            purpose="logo"
            onChange={(url) => {
              upd("logoUrl", url);
              if (!data.faviconUrl || data.faviconUrl === data.logoUrl) {
                upd("faviconUrl", url);
              }
            }}
            onClear={() => {
              if (data.faviconUrl === data.logoUrl) {
                upd("faviconUrl", "");
              }
              upd("logoUrl", "");
            }}
            onBrandColorsExtracted={(colors) => {
              upd("primaryColor", colors.primaryColor);
              upd("secondaryColor", colors.secondaryColor);
              notify.success(t("branding.logoColorsApplied"), {
                description: t("branding.logoColorsAppliedDesc"),
              });
            }}
          />
          <ImageUploadField
            id="branding-favicon"
            label={t("branding.favicon")}
            hint={t("branding.faviconHint")}
            value={data.faviconUrl}
            onChange={(url) => upd("faviconUrl", url)}
            onClear={() => upd("faviconUrl", "")}
            purpose="favicon"
            previewSize="favicon"
          />
        </div>
      </div>
    </SectionCard>
  );
}

interface BrandingSettingsContactSectionProps {
  data: BrandingSettings;
  upd: <K extends keyof BrandingSettings>(key: K, value: BrandingSettings[K]) => void;
}

export function BrandingSettingsContactSection({
  data,
  upd,
}: BrandingSettingsContactSectionProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <SectionCard
      title={t("branding.contactTitle")}
      subtitle={t("branding.contactSubtitle")}
      icon={Mail}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="branding-email">{t("branding.email")}</Label>
          <LeadingIconInput
            id="branding-email"
            name="brandingEmail"
            type="email"
            inputMode="email"
            autoComplete="email"
            icon={Mail}
            value={data.email}
            placeholder={t("branding.emailPlaceholder")}
            onChange={(event) => upd("email", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="branding-phone">{t("branding.phone")}</Label>
          <LeadingIconInput
            id="branding-phone"
            name="brandingPhone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            icon={Phone}
            value={data.phone}
            placeholder={t("branding.phonePlaceholder")}
            onChange={(event) => upd("phone", event.target.value)}
            onBlur={() => upd("phone", normalizePhoneInput(data.phone))}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="branding-website">{t("branding.website")}</Label>
          <LeadingIconInput
            id="branding-website"
            name="brandingWebsite"
            type="url"
            inputMode="url"
            icon={Globe}
            value={data.website}
            placeholder={t("branding.websitePlaceholder")}
            onChange={(event) => upd("website", event.target.value)}
          />
        </div>
      </div>
    </SectionCard>
  );
}
