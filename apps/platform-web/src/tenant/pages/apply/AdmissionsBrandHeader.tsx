import React, { useState } from "react";
import { GraduationCap, ShieldCheck } from "lucide-react";
import { useTranslation } from "@mms/fe-core/i18n";
import { cn } from "@/lib/utils";

export interface AdmissionsBrandHeaderProps {
  logoUrl?: string | null;
  institutionName?: string | null;
  subtitle?: React.ReactNode;
  heroTitle?: React.ReactNode;
  heroSubtitle?: React.ReactNode;
  className?: string;
}

function getMonogramInitials(name?: string | null): string {
  if (!name || !name.trim()) return "MMS";
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.trim().slice(0, 3).toUpperCase();
}

/**
 * Centered institutional brand header displaying the tenant logo (or monogram emblem fallback),
 * institution name, trust badge, and optional hero title/subtext.
 */
export function AdmissionsBrandHeader({
  logoUrl,
  institutionName,
  subtitle,
  heroTitle,
  heroSubtitle,
  className,
}: AdmissionsBrandHeaderProps): React.JSX.Element {
  const { t } = useTranslation();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const hasLogo = Boolean(logoUrl && failedUrl !== logoUrl);
  const initials = getMonogramInitials(institutionName);

  return (
    <header className={cn("flex flex-col items-center gap-3 text-center", className)}>
      <div className="flex justify-center">
        {hasLogo ? (
          <img
            src={logoUrl!}
            alt={institutionName || t("branding.logo")}
            onError={() => setFailedUrl(logoUrl!)}
            className="size-16 sm:size-20 rounded-2xl object-contain p-1.5 bg-card border border-border/60 shadow-xs ring-1 ring-border/30"
          />
        ) : (
          <div
            data-testid="admissions-brand-monogram"
            className="size-16 sm:size-20 rounded-2xl bg-primary/10 border border-primary/20 shadow-xs ring-1 ring-primary/20 flex flex-col items-center justify-center text-primary select-none"
            aria-label={institutionName || "Institution monogram"}
          >
            <GraduationCap className="size-6 text-primary mb-0.5" aria-hidden />
            <span className="text-xs font-bold tracking-wider uppercase">{initials}</span>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <p className="text-base sm:text-lg font-bold text-foreground tracking-tight">
          {institutionName || "Madrasa"}
        </p>
        <div className="inline-flex items-center justify-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success border border-success/30">
          <ShieldCheck className="size-3.5 text-success" aria-hidden />
          <span>{subtitle ?? t("apply.portalSubtitle")}</span>
        </div>
      </div>

      {heroTitle && (
        <div className="space-y-1.5 pt-2">
          <h1 className="text-balance text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            {heroTitle}
          </h1>
          {heroSubtitle && (
            <p className="text-pretty text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
              {heroSubtitle}
            </p>
          )}
        </div>
      )}
    </header>
  );
}
