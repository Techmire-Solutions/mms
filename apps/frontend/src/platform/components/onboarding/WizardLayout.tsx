import React, { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { AuthPageBackdrop } from "@/components/entry/AuthPageShell";
import { PlatformLogoMark } from "@/platform/components/PlatformPageShell";
import { Button } from "@/components/ui/button";
import { WizardStepIndicator } from "@/components/app/WizardStepIndicator";
import { ROUTES } from "@/lib/config/routes";

export interface WizardStepConfig {
  id: number;
  label: string;
}

interface WizardLayoutProps {
  currentStep: number;
  steps: WizardStepConfig[];
  children: ReactNode;
  title: string;
  subtitle?: string;
}

/**
 * Layout wrapper for platform onboarding wizard — English/LTR only.
 */
export default function WizardLayout({
  currentStep,
  steps,
  children,
  title,
  subtitle,
}: WizardLayoutProps): React.JSX.Element {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const stepLabel = t("onboarding.stepOf", {
    current: String(currentStep),
    total: String(steps.length),
  });

  return (
    <div
      dir="ltr"
      lang="en"
      className="relative flex min-h-dvh flex-col overflow-hidden bg-background selection:bg-primary/10 selection:text-primary"
    >
      <AuthPageBackdrop />

      <header className="sticky top-0 z-sticky flex h-14 items-center justify-between border-b border-border bg-background px-4 shadow-2xs sm:px-6">
        <div className="flex items-center gap-2.5">
          <PlatformLogoMark size="sm" />
          <span className="text-sm font-semibold uppercase tracking-wider text-foreground">
            {t("entry.productName")}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-muted-foreground" aria-live="polite">
            {stepLabel}
          </span>
          <Button asChild variant="ghost" size="sm" className="min-h-11 gap-1.5 rounded-lg">
            <Link to={ROUTES.home}>
              <X className="h-4 w-4" aria-hidden />
              {t("onboarding.exitToConsole")}
            </Link>
          </Button>
        </div>
      </header>

      <div
        className="relative z-sticky h-1 w-full bg-muted"
        role="progressbar"
        aria-valuenow={currentStep}
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuetext={stepLabel}
      >
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
          initial={false}
          animate={{ width: `${(currentStep / steps.length) * 100}%` }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.45, ease: "easeOut" }}
        />
      </div>

      <main
        id="main-content"
        className="relative z-elevated flex flex-1 flex-col items-center px-4 py-8 sm:px-6 sm:py-10"
      >
        <nav aria-label={stepLabel} className="mb-8 flex justify-center w-full max-w-2xl sm:mb-10">
          <WizardStepIndicator steps={steps} current={currentStep} ariaLabel={stepLabel} />
        </nav>

        <motion.section
          key={currentStep}
          initial={reducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.18, ease: "easeOut" }}
          className="relative w-full max-w-2xl overflow-hidden rounded-2xl surface-raised"
          aria-labelledby="wizard-step-title"
        >
          <header className="border-b border-border/50 bg-muted/10 px-6 py-5 sm:px-8">
            <h1
              id="wizard-step-title"
              className="m-0 text-lg font-bold tracking-tight text-foreground sm:text-xl text-balance"
            >
              {title}
            </h1>
            {subtitle ? (
              <p className="m-0 mt-1 text-sm font-medium leading-relaxed text-muted-foreground">
                {subtitle}
              </p>
            ) : null}
          </header>
          <div className="px-6 py-6 sm:px-8 sm:py-7">{children}</div>
        </motion.section>
      </main>
    </div>
  );
}
