import React, { useState } from "react";
import { m, AnimatePresence } from "framer-motion";
import { ArrowRight, Building2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { type BrandingSettings } from "@mms/shared";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { getWorkspaceLocalStoragePrefix } from "@/lib/dbStorageCore";
import { settingsTabPath } from "@/lib/config/settingsDeepLink";

interface SetupIncompleteCalloutProps {
  branding: BrandingSettings;
  /** Only show to admins who can write settings. */
  isAdmin: boolean;
}

/** Returns true when the institution profile has enough filled-in fields. */
export function isInstitutionProfileComplete(branding: BrandingSettings): boolean {
  return !!(
    branding.logoUrl ||
    branding.country ||
    branding.email ||
    branding.phone ||
    branding.tagline
  );
}

const DISMISSED_KEY = "mms_setup_callout_dismissed";

/** Dismissal is per workspace — a shared browser must not hide another madrasa's callout. */
function dismissedStorageKey(): string {
  return `${getWorkspaceLocalStoragePrefix()}${DISMISSED_KEY}`;
}

/**
 * One-time banner shown to tenant admins when institution branding fields
 * (logo, country, contact info) haven't been configured yet.
 * Disappears once dismissed or the profile is filled in.
 */
export function SetupIncompleteCallout({
  branding,
  isAdmin,
}: SetupIncompleteCalloutProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const navigate = useNavigate();
  const storageKey = dismissedStorageKey();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });

  if (!isAdmin || dismissed || isInstitutionProfileComplete(branding)) return null;

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(storageKey, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      <m.div
        initial={reducedMotion ? false : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
        transition={reducedMotion ? { duration: 0 } : { duration: 0.3, ease: "easeOut" }}
        role="status"
        aria-live="polite"
        className="relative flex items-start gap-4 rounded-2xl border border-warning/30 bg-warning/10 px-5 py-4 shadow-sm"
      >
        {/* Icon */}
        <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-warning/15 text-warning">
          <Building2 className="h-4.5 w-4.5" aria-hidden />
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground">{t("dashboard.setupCallout.title")}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {t("dashboard.setupCallout.description")}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 gap-1.5 rounded-lg border-warning/40 bg-background px-3 text-xs font-bold text-warning hover:bg-warning/15 transition-colors"
            onClick={() => navigate(settingsTabPath("branding"))}
          >
            {t("dashboard.setupCallout.cta")}
            <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180 transition-transform" aria-hidden />
          </Button>
        </div>

        {/* Dismiss */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("common.dismiss")}
          onClick={handleDismiss}
          className="flex-shrink-0 text-muted-foreground hover:bg-warning/15 hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden />
        </Button>
      </m.div>
    </AnimatePresence>
  );
}
