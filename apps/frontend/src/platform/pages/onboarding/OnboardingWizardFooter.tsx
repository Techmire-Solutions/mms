import { ArrowRight, ArrowLeft } from "lucide-react";
import { WarningCallout } from "@/components/app/WarningCallout";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/config/routes";
import { tenantUrl } from "@/lib/config/tenantConfig";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

interface OnboardingWizardFooterProps {
  t: TranslationFunction;
  step: number;
  loading: boolean;
  submitError: string | null;
  showSignInLink: boolean;
  conflictSubdomain: string;
  isLastStep: boolean;
  form?: string;
  onBack: () => void;
  onNext: () => void;
}

export function OnboardingWizardFooter({
  t,
  step,
  loading,
  submitError,
  showSignInLink,
  conflictSubdomain,
  isLastStep,
  form = "onboarding-wizard-form",
  onBack,
  onNext,
}: OnboardingWizardFooterProps) {
  const signInHref =
    showSignInLink && conflictSubdomain.trim()
      ? tenantUrl(conflictSubdomain.trim().toLowerCase(), ROUTES.login)
      : null;

  return (
    <>
      {submitError ? (
        <WarningCallout
          tone="destructive"
          density="compact"
          role="alert"
          className="mt-4"
          description={
            <>
              {submitError}{" "}
              {signInHref ? (
                <a
                  href={signInHref}
                  className="inline-flex min-h-11 items-center font-semibold underline"
                >
                  {t("onboarding.signInInstead")}
                </a>
              ) : null}
            </>
          }
        />
      ) : null}

      <div className="mt-7 flex items-center justify-between gap-3 border-t border-border/50 pt-5">
        <Button
          type="button"
          variant="ghost"
          size="md"
          onClick={onBack}
          disabled={step === 1 || loading}
          className="text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
          {t("onboarding.back")}
        </Button>

        <Button
          type={form ? "submit" : "button"}
          form={form}
          variant="primary"
          size="md"
          onClick={(event) => {
            event.preventDefault();
            onNext();
          }}
          loading={loading}
          className="px-5 font-semibold shadow-md shadow-primary/10"
        >
          {loading ? (
            t("common.loading")
          ) : (
            <>
              {isLastStep ? t("onboarding.createWorkspace") : t("onboarding.continue")}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
            </>
          )}
        </Button>
      </div>
    </>
  );
}
