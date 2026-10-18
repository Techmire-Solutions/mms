import React, { useEffect } from "react";
import { DEFAULT_BRANDING_SETTINGS, type PublicBranding, getInitials } from "@mms/shared";
import { useTenant } from "@/lib/contexts/TenantContext";
import { applyTenantEntryTheme } from "@/lib/branding/tenantEntryTheme";
import { applyTenantDocumentFavicon } from "@/lib/documentFavicon";
import { LOGO_IMAGE } from "@/lib/ui/semanticTone";
import { useTranslation } from "@/hooks/useTranslation";
import { useTenantBranding } from "@/tenant/hooks/useTenantBranding";
import {
  AuthCardShell,
  AuthFormHeading,
  AuthLoadingShell,
  AuthPageFrame,
} from "@/components/entry";

export interface AuthLayoutProps {
  children?: React.ReactNode;
  title?: string;
  subtitle?: string;
  footer?: React.ReactNode;
}

/**
 * Centered layout for pre-authenticated auth screens (login, 2FA, forgot password).
 * Uses server public branding — no localStorage db reads on the entry path.
 * Document title is owned by EntryPageHead on each page (SSOT).
 */
export default function AuthLayout({
  children,
  title,
  subtitle,
  footer,
}: AuthLayoutProps): React.JSX.Element {
  const { t } = useTranslation();
  const { ready: brandingReady } = useTenantBranding();
  const { workspace, publicBranding } = useTenant();

  const displayName =
    publicBranding?.madrasaName.trim() || workspace?.madrasaName.trim() || t("entry.productName");
  const displayTagline = publicBranding?.tagline.trim() || workspace?.tagline?.trim() || "";
  const logoUrl = publicBranding?.logoUrl.trim() || "";

  const entryBranding = ((): PublicBranding | null => {
    if (publicBranding) {
      return publicBranding;
    }
    if (!workspace?.madrasaName) {
      return null;
    }
    return {
      madrasaName: workspace.madrasaName,
      tagline: workspace.tagline ?? "",
      logoUrl: "",
      faviconUrl: "",
      primaryColor: DEFAULT_BRANDING_SETTINGS.primaryColor,
      secondaryColor: DEFAULT_BRANDING_SETTINGS.secondaryColor,
    };
  })();

  useEffect(() => {
    if (!brandingReady || !entryBranding) {
      return;
    }
    applyTenantEntryTheme(entryBranding);
    applyTenantDocumentFavicon({
      faviconUrl: entryBranding.faviconUrl,
      logoUrl: entryBranding.logoUrl,
      madrasaName: entryBranding.madrasaName || displayName,
      primaryColor: entryBranding.primaryColor,
    });
  }, [brandingReady, entryBranding, displayName]);

  if (!brandingReady) {
    return <AuthLoadingShell />;
  }

  return (
    <AuthPageFrame>
      <AuthCardShell
        footer={footer}
        header={
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={displayName}
                  width={64}
                  height={64}
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                  className={`h-16 w-16 rounded-2xl shadow-surface ${LOGO_IMAGE}`}
                />
              ) : (
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 shadow-sm"
                  role="img"
                  aria-label={displayName}
                >
                  <span className="font-display text-2xl font-bold text-primary" aria-hidden>
                    {getInitials(displayName, 1)}
                  </span>
                </div>
              )}
              <p className="text-base font-semibold text-foreground">{displayName}</p>
              {displayTagline ? (
                <p className="max-w-sidebar-mobile text-sm leading-relaxed text-muted-foreground">
                  {displayTagline}
                </p>
              ) : null}
            </div>

            {title ? (
              <div className="border-t border-border/40 pt-4">
                <AuthFormHeading title={title} subtitle={subtitle} />
              </div>
            ) : null}
          </div>
        }
      >
        {children}
      </AuthCardShell>
    </AuthPageFrame>
  );
}
