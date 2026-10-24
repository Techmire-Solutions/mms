import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Sparkles, CheckCircle2, ArrowRight } from "lucide-react";
import { type BrandingSettings, mergeBrandingSettings } from "@mms/shared";

import { useTranslation } from "@/hooks/useTranslation";
import { useBranding } from "@/tenant/hooks/useBranding";
import { saveBrandingSettings } from "@/lib/db";
import { ROUTES } from "@/lib/config/routes";
import { notify } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import BrandingIdentityPreview from "@/components/branding/BrandingIdentityPreview";
import EntryPageHead, { formatEntryTitle } from "@/components/entry/EntryPageHead";
import { useMarkInstitutionSetupComplete } from "@/tenant/hooks/useInstitutionSetupStatus";
import {
  InstitutionSetupFormSections,
  type InstitutionSetupFieldErrors,
} from "@/tenant/pages/setup/InstitutionSetupFormSections";

export default function InstitutionSetup(): React.JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const currentBranding = useBranding();
  const markInstitutionSetupComplete = useMarkInstitutionSetupComplete();

  const [data, setData] = useState<BrandingSettings>(() => mergeBrandingSettings(currentBranding));
  const [errors, setErrors] = useState<InstitutionSetupFieldErrors>({});
  const [saving, setSaving] = useState(false);

  const updateField = <K extends keyof BrandingSettings>(
    field: K,
    value: BrandingSettings[K],
  ): void => {
    setData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof InstitutionSetupFieldErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = (): boolean => {
    const nextErrors: InstitutionSetupFieldErrors = {};
    const reqKey = t("institutionSetup.fieldRequired");

    if (!data.madrasaName.trim()) nextErrors.madrasaName = reqKey;
    if (!data.tagline.trim()) nextErrors.tagline = reqKey;
    if (!data.email.trim()) nextErrors.email = reqKey;
    if (!data.phone.trim()) nextErrors.phone = reqKey;
    if (!data.addressLine1.trim()) nextErrors.addressLine1 = reqKey;
    if (!data.city.trim()) nextErrors.city = reqKey;
    if (!data.country.trim()) nextErrors.country = reqKey;
    if (!data.postalCode.trim()) nextErrors.postalCode = reqKey;

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!validate()) {
      notify.error(t("common.formPleaseFixErrors"), {
        description: t("institutionSetup.fieldRequired"),
      });
      return;
    }

    setSaving(true);
    try {
      const merged = mergeBrandingSettings(data);
      const res = await saveBrandingSettings(merged);
      if (!res.ok) {
        throw new Error("Failed to persist institution settings");
      }
      markInstitutionSetupComplete();
      notify.success(t("institutionSetup.success"), {
        description: t("branding.savedToastDesc"),
      });
      navigate(ROUTES.home, { replace: true });
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : t("branding.imageErrorUpload"));
    } finally {
      setSaving(false);
    }
  };

  const pageTitle = formatEntryTitle(t("institutionSetup.title"), t("entry.productName"));

  return (
    <>
      <EntryPageHead title={pageTitle} description={t("institutionSetup.subtitle")} />

      <main className="min-h-screen bg-muted/20 py-8 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-none space-y-6">
          {/* Header Banner */}
          <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Building2 className="h-6 w-6" aria-hidden />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                    {t("institutionSetup.title")}
                  </h1>
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    <Sparkles className="h-3 w-3" />
                    {t("common.required")}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t("institutionSetup.subtitle")}
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Form inputs (2 cols) */}
              <div className="lg:col-span-2">
                <InstitutionSetupFormSections
                  data={data}
                  errors={errors}
                  updateField={updateField}
                />
              </div>

              {/* Sidebar Preview (1 col) */}
              <div className="space-y-6">
                <div className="sticky top-6 space-y-4">
                  <div className="space-y-1">
                    <h2 className="text-sm font-semibold text-foreground">
                      {t("branding.previewTitle")}
                    </h2>
                    <p className="text-xs text-muted-foreground">{t("branding.previewSubtitle")}</p>
                  </div>
                  <BrandingIdentityPreview data={data} />

                  <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("common.actions")}
                    </h3>
                    <Button
                      type="submit"
                      disabled={saving}
                      className="w-full min-h-11 rounded-xl text-sm font-semibold shadow-sm"
                    >
                      {saving ? (
                        t("institutionSetup.saving")
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4" />
                          {t("institutionSetup.submit")}
                          <ArrowRight className="h-4 w-4" />
                        </span>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      </main>
    </>
  );
}
