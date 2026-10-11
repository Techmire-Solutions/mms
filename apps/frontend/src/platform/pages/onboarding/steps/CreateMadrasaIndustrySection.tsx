import React from "react";
import { Building2, GraduationCap, Hotel, Briefcase, Store, Sliders, Check } from "lucide-react";
import { SectionCard } from "@/components/ui/SectionCard";
import { Label } from "@/components/ui/label";
import { INDUSTRY_PROFILES, type IndustryType } from "@mms/shared";
import type { CreateMadrasaController } from "@/platform/pages/onboarding/steps/useCreateMadrasaController";

interface CreateMadrasaIndustrySectionProps {
  controller: CreateMadrasaController;
}

const INDUSTRY_ICONS: Record<IndustryType, React.ComponentType<{ className?: string }>> = {
  madrasa: GraduationCap,
  hotel: Hotel,
  office: Briefcase,
  retail: Store,
  custom: Sliders,
  general: Building2,
};

const AVAILABLE_INDUSTRIES: IndustryType[] = ["madrasa", "hotel", "office", "retail", "custom"];

export function CreateMadrasaIndustrySection({
  controller,
}: CreateMadrasaIndustrySectionProps): React.JSX.Element {
  const { t, data, handleIndustryChange } = controller;

  return (
    <SectionCard
      title={t("organization.industryProfile")}
      subtitle={t("organization.industryProfileDesc")}
      icon={Building2}
    >
      <div className="space-y-3">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("organization.selectIndustry")}
        </Label>
        <div
          role="radiogroup"
          aria-label={t("organization.industryProfile")}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5"
        >
          {AVAILABLE_INDUSTRIES.map((ind) => {
            const profile = INDUSTRY_PROFILES[ind];
            const Icon = INDUSTRY_ICONS[ind] ?? Building2;
            const isSelected = data.industryType === ind;

            return (
              <div
                key={ind}
                role="radio"
                tabIndex={0}
                aria-checked={isSelected}
                onClick={() => handleIndustryChange(ind)}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    handleIndustryChange(ind);
                  }
                }}
                className={`relative flex items-start gap-3 rounded-xl border p-3.5 text-start cursor-pointer transition-all ${
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary shadow-xs"
                    : "border-border/70 bg-card hover:border-border hover:bg-accent/40"
                }`}
              >
                <div
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-sm font-semibold text-foreground">
                      {t(profile.displayNameKey)}
                    </span>
                    {isSelected && (
                      <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    )}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {t(profile.descriptionKey)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SectionCard>
  );
}
