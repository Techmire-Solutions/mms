import React from "react";
import { Globe, Check, Type } from "lucide-react";
import { SectionCard } from "@/components/app/SectionCard";
import { Input } from "@shared/ui";
import { Label } from "@shared/ui";
import { RequiredMark } from "@/components/app/FormField";
import { FieldHint, NAME_MAX } from "@/components/branding/BrandingShared";
import type { CreateMadrasaController } from "@/platform/pages/onboarding/steps/useCreateMadrasaController";

interface CreateMadrasaIdentitySectionProps {
  controller: CreateMadrasaController;
}

export function CreateMadrasaIdentitySection({
  controller,
}: CreateMadrasaIdentitySectionProps): React.ReactElement {
  const { t, appDomain, data, handleNameChange, handleSubdomainChange } = controller;

  return (
    <SectionCard
      title={t("branding.identityTitle")}
      subtitle={t("branding.identitySubtitle")}
      icon={Type}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="onboarding-name">
              {t("branding.madrasaName")} <RequiredMark />
            </Label>
            <span className="text-xs text-muted-foreground" aria-live="polite">
              {data.name.length}/{NAME_MAX}
            </span>
          </div>
          <Input
            id="onboarding-name"
            name="madrasaName"
            value={data.name}
            maxLength={NAME_MAX}
            autoFocus
            required
            placeholder={t("branding.madrasaNamePlaceholder")}
            aria-describedby="onboarding-name-hint"
            onChange={(event) => handleNameChange(event.target.value)}
          />
          <FieldHint id="onboarding-name-hint">{t("branding.madrasaNameHint")}</FieldHint>
        </div>

        <div className="space-y-2">
          <Label htmlFor="onboarding-subdomain">
            {t("onboarding.madrasa.subdomainLabel")} <RequiredMark />
          </Label>
          <div className="flex items-center overflow-hidden rounded-lg border border-border focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
            <div className="flex items-center gap-1.5 border-e border-border bg-muted px-3 py-2.5">
              <Globe className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            </div>
            <Input
              id="onboarding-subdomain"
              name="madrasaSubdomain"
              value={data.subdomain}
              placeholder={t("onboarding.madrasa.subdomainPlaceholder")}
              required
              className="border-0 rounded-none focus-visible:ring-0"
              aria-describedby={data.subdomain ? "onboarding-subdomain-url" : undefined}
              onChange={(event) => handleSubdomainChange(event.target.value)}
            />
            <div className="border-s border-border bg-muted px-3 py-2.5">
              <span className="text-xs text-muted-foreground">.{appDomain}</span>
            </div>
          </div>
          {data.subdomain && (
            <p
              id="onboarding-subdomain-url"
              className="flex items-center gap-1 text-xs text-muted-foreground"
            >
              <Check className="h-3 w-3 text-primary" aria-hidden />
              {t("onboarding.madrasa.yourUrl")}{" "}
              <span className="font-medium text-foreground">
                {data.subdomain}.{appDomain}
              </span>
            </p>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
