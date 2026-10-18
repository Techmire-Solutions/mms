import { ArrowRight, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@shared/ui";
import { useTranslation } from "@/hooks/useTranslation";
import { ROUTES } from "@/lib/config/routes";

const prefetchOnboarding = () => {
  void import("@/platform/pages/onboarding/OnboardingWizard");
};

export function PlatformOnboardingAction() {
  const { t } = useTranslation();
  return (
    <Button
      asChild
      className="font-bold px-5 shadow-xs"
      onMouseEnter={prefetchOnboarding}
      onFocus={prefetchOnboarding}
    >
      <Link to={ROUTES.onboarding}>
        <Plus aria-hidden />
        {t("auth.createMadrasa")}
        <ArrowRight className="rtl:rotate-180" aria-hidden />
      </Link>
    </Button>
  );
}
