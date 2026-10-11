import React from "react";
import { ArrowRight } from "lucide-react";
import PlatformAuthLayout from "@/platform/components/PlatformAuthLayout";
import { AuthBackLink, AuthCheckEmailSuccess, AuthStatusBanner } from "@/components/entry";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/config/routes";
import type { PlatformForgotPasswordController } from "@/platform/pages/auth/usePlatformForgotPasswordController";

interface PlatformForgotPasswordSentStepProps {
  controller: PlatformForgotPasswordController;
}

export function PlatformForgotPasswordSentStep({ controller }: PlatformForgotPasswordSentStepProps): React.JSX.Element {
  const { t, email, resetId, devHint, setSent, setEmail, setDevHint, resetPath, navigate } = controller;

  return (
    <PlatformAuthLayout
      title={t("auth.forgotCheckEmail")}
      subtitle={t("platform.forgotSentGeneric", { email: email.trim() })}
    >
      <AuthCheckEmailSuccess
        secondaryLabel={t("auth.tryDifferentEmail")}
        onSecondary={() => {
          setSent(false);
          setEmail("");
          setDevHint(null);
        }}
        footer={<AuthBackLink to={ROUTES.home} label={t("auth.backToSignIn")} />}
      >
        {devHint ? <AuthStatusBanner variant="warning" message={devHint} /> : null}
        {resetId ? (
          <Button
            type="button"
            variant="primary"
            size="md"
            className="w-full"
            onClick={() => navigate(resetPath(resetId))}
          >
            {t("platform.forgotEnterCode")}
            <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
          </Button>
        ) : null}
      </AuthCheckEmailSuccess>
    </PlatformAuthLayout>
  );
}
