import React, { useState } from "react";
import { Building2, Mail, MapPin, Share2 } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { Field } from "@/components/app/FormPrimitives";
import { SectionCard } from "@/components/app/SectionCard";
import { SettingsFormActions } from "@/components/app/SettingsFormActions";
import { SettingsPanel } from "@/components/app/SettingsShell";
import { ImageUploadField, SocialLinksEditor } from "@/components/branding/BrandingShared";
import BrandingIdentityPreview from "@/components/branding/BrandingIdentityPreview";
import { Alert } from "@/components/app/Alert";
import { PlatformSettingsLoadError } from "@/platform/features/settings/components/PlatformSettingsLoadError";
import { CardSkeleton, Input, Label } from "@shared/ui";
import { useSavedFlash } from "@/hooks/useSavedFlash";
import {
  PLATFORM_BRANDING_IDENTITY_FIELD_KEYS,
  platformBrandingToBrandingSettings,
  pickPlatformBrandingFields,
  type PlatformBrandingDto,
} from "@mms/shared";
import {
  usePlatformBrandingQuery,
  useUpdatePlatformBranding,
} from "@/platform/features/settings/hooks/usePlatformBrandingData";
import { getPlatformErrorMessage } from "@/platform/features/auth/lib/platformAuthErrors";

type Draft = PlatformBrandingDto;

const IDENTITY_KEYS = PLATFORM_BRANDING_IDENTITY_FIELD_KEYS;

/** Operator identity, assets, contact, address, and social profiles for the apex. */
export default function PlatformBrandingSettingsPanel(): React.JSX.Element {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = usePlatformBrandingQuery();
  const updateBranding = useUpdatePlatformBranding();
  const { saved, flashSaved } = useSavedFlash();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [prevData, setPrevData] = useState(data);

  const isDirty =
    Boolean(draft && data) &&
    IDENTITY_KEYS.some((key) => (draft as Draft)[key] !== (data as Draft)[key]);

  if (data !== prevData) {
    setPrevData(data);
    if (data && (!draft || !isDirty)) setDraft({ ...data });
  }

  if (isLoading || !draft) return <CardSkeleton count={2} />;
  if (isError) return <PlatformSettingsLoadError onRetry={() => void refetch()} />;

  const upd = <K extends keyof Draft>(key: K, value: Draft[K]): void => {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
    setFormError(null);
  };

  const handleSave = async (): Promise<void> => {
    setFormError(null);
    try {
      await updateBranding.mutateAsync({
        branding: pickPlatformBrandingFields(draft, IDENTITY_KEYS),
        ...(data?.updatedAt ? { expectedUpdatedAt: data.updatedAt } : {}),
      });
      flashSaved();
    } catch (error) {
      setFormError(getPlatformErrorMessage(error, t, undefined, "platform.loadFailed"));
    }
  };

  const handleDiscard = (): void => {
    setDraft(data ? { ...data } : null);
    setFormError(null);
  };

  return (
    <SettingsPanel
      width="medium"
      introKey="platform.settings.introBranding"
      isDirty={isDirty}
      saved={saved}
      footer={
        <SettingsFormActions
          saveLabel={t("branding.save")}
          savingLabel={t("branding.saving")}
          onSave={() => void handleSave()}
          onDiscard={handleDiscard}
          discardLabel={t("theme.discardChanges")}
          dirty={isDirty}
          saving={updateBranding.isPending}
        />
      }
    >
      <BrandingIdentityPreview data={platformBrandingToBrandingSettings(draft)} />

      <SectionCard
        title={t("branding.previewTitle")}
        subtitle={t("platform.settings.brandingIdentityDesc")}
        icon={Building2}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="platform-product-name"
            label={t("platform.settings.productName")}
            hint={t("platform.settings.productNameHint")}
          >
            <Input
              id="platform-product-name"
              value={draft.productName}
              maxLength={60}
              onChange={(event) => upd("productName", event.target.value)}
              className="h-10 rounded-xl"
            />
          </Field>
          <Field
            id="platform-console-title"
            label={t("platform.settings.consoleTitle")}
            hint={t("platform.settings.consoleTitleHint")}
          >
            <Input
              id="platform-console-title"
              value={draft.consoleTitle}
              maxLength={60}
              onChange={(event) => upd("consoleTitle", event.target.value)}
              className="h-10 rounded-xl"
            />
          </Field>
          <Field id="platform-tagline" label={t("branding.tagline")}>
            <Input
              id="platform-tagline"
              value={draft.tagline}
              maxLength={120}
              onChange={(event) => upd("tagline", event.target.value)}
              className="h-10 rounded-xl"
            />
          </Field>
          <div className="space-y-2">
            <Label className="text-xs font-medium">{t("branding.logo")}</Label>
            <ImageUploadField
              id="platform-logo"
              label={t("branding.logo")}
              hint={t("branding.logoHint")}
              value={draft.logoUrl}
              purpose="logo"
              onChange={(url) => upd("logoUrl", url)}
              onClear={() => upd("logoUrl", "")}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium">{t("branding.favicon")}</Label>
            <ImageUploadField
              id="platform-favicon"
              label={t("branding.favicon")}
              hint={t("branding.faviconHint")}
              value={draft.faviconUrl}
              purpose="favicon"
              previewSize="favicon"
              onChange={(url) => upd("faviconUrl", url)}
              onClear={() => upd("faviconUrl", "")}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title={t("branding.contactTitle")}
        subtitle={t("branding.contactSubtitle")}
        icon={Mail}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="platform-email" label={t("branding.email")}>
            <Input
              id="platform-email"
              type="email"
              value={draft.email}
              onChange={(e) => upd("email", e.target.value)}
              className="h-10 rounded-xl"
            />
          </Field>
          <Field id="platform-phone" label={t("branding.phone")}>
            <Input
              id="platform-phone"
              value={draft.phone}
              onChange={(e) => upd("phone", e.target.value)}
              className="h-10 rounded-xl"
            />
          </Field>
          <Field id="platform-website" label={t("branding.website")}>
            <Input
              id="platform-website"
              value={draft.website}
              onChange={(e) => upd("website", e.target.value)}
              className="h-10 rounded-xl"
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title={t("branding.addressTitle")}
        subtitle={t("branding.addressSubtitle")}
        icon={MapPin}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="platform-legal-name" label={t("branding.legalName")}>
            <Input
              id="platform-legal-name"
              value={draft.legalName}
              onChange={(e) => upd("legalName", e.target.value)}
              className="h-10 rounded-xl"
            />
          </Field>
          <Field id="platform-registration" label={t("branding.registrationNumber")}>
            <Input
              id="platform-registration"
              value={draft.registrationNumber}
              onChange={(e) => upd("registrationNumber", e.target.value)}
              className="h-10 rounded-xl"
            />
          </Field>
          <Field id="platform-address-1" label={t("branding.addressLine1")}>
            <Input
              id="platform-address-1"
              value={draft.addressLine1}
              onChange={(e) => upd("addressLine1", e.target.value)}
              className="h-10 rounded-xl"
            />
          </Field>
          <Field id="platform-address-2" label={t("branding.addressLine2")}>
            <Input
              id="platform-address-2"
              value={draft.addressLine2}
              onChange={(e) => upd("addressLine2", e.target.value)}
              className="h-10 rounded-xl"
            />
          </Field>
          <Field id="platform-city" label={t("branding.city")}>
            <Input
              id="platform-city"
              value={draft.city}
              onChange={(e) => upd("city", e.target.value)}
              className="h-10 rounded-xl"
            />
          </Field>
          <Field id="platform-region" label={t("branding.region")}>
            <Input
              id="platform-region"
              value={draft.region}
              onChange={(e) => upd("region", e.target.value)}
              className="h-10 rounded-xl"
            />
          </Field>
          <Field id="platform-postal" label={t("branding.postalCode")}>
            <Input
              id="platform-postal"
              value={draft.postalCode}
              onChange={(e) => upd("postalCode", e.target.value)}
              className="h-10 rounded-xl"
            />
          </Field>
          <Field id="platform-country" label={t("branding.country")}>
            <Input
              id="platform-country"
              value={draft.country}
              onChange={(e) => upd("country", e.target.value)}
              className="h-10 rounded-xl"
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title={t("branding.socialTitle")}
        subtitle={t("branding.socialSubtitle")}
        icon={Share2}
      >
        <SocialLinksEditor
          links={draft.socialLinks}
          onChange={(links) => upd("socialLinks", links)}
        />
      </SectionCard>

      {formError ? (
        <Alert tone="destructive" density="compact" role="alert" description={formError} />
      ) : null}
    </SettingsPanel>
  );
}
