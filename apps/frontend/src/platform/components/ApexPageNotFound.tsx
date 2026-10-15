import React from "react";
import { Link, useLocation } from "react-router-dom";
import { FileQuestion } from "lucide-react";
import { platformUserCan } from "@mms/shared";
import { usePlatformAuth } from "@/platform/lib/PlatformAuthContext";
import { ROUTES } from "@/lib/config/routes";
import { useTranslation } from "@/hooks/useTranslation";
import EntryPageHead, { formatEntryTitle } from "@/components/entry/EntryPageHead";
import { AuthCardShell, AuthPageFrame } from "@/components/entry/AuthPageShell";
import { AuthStatusHeader } from "@/components/entry/AuthStatusBanner";
import { Button } from "@shared/ui";

/** 404 page for platform apex routes only — no tenant auth/RBAC coupling. */
export default function ApexPageNotFound(): React.JSX.Element {
  const location = useLocation();
  const { isPlatformAuthenticated, platformUser } = usePlatformAuth();
  const { t } = useTranslation();
  const canOnboard = platformUserCan(platformUser, "onboard");

  const primaryLabel = isPlatformAuthenticated
    ? t("page.notFound.goDashboard")
    : t("page.notFound.goHome");

  return (
    <>
      <EntryPageHead
        title={formatEntryTitle(t("page.notFound.title"), t("entry.productName"))}
        description={t("entry.meta.apexNotFound")}
      />
      <AuthPageFrame dir="ltr">
        <AuthCardShell
          className="max-w-md"
          header={
            <AuthStatusHeader
              icon={FileQuestion}
              title={t("page.notFound.title")}
              description={t("page.notFound.message", { path: location.pathname })}
            />
          }
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-11 flex-1 rounded-xl font-semibold">
              <Link to={ROUTES.home}>{primaryLabel}</Link>
            </Button>
            {isPlatformAuthenticated && canOnboard ? (
              <Button asChild variant="outline" size="lg" className="h-11 flex-1 rounded-xl">
                <Link to={ROUTES.onboarding}>{t("auth.createMadrasa")}</Link>
              </Button>
            ) : null}
          </div>
        </AuthCardShell>
      </AuthPageFrame>
    </>
  );
}
