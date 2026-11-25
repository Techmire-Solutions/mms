import { Link, useLocation } from "react-router-dom";
import React from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { usePermissions } from "@/tenant/hooks/usePermissions";
import { ROUTES } from "@/lib/config/routes";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@mms/ui";

/** Tenant-only 404 — mounted only on madrasa subdomain routes. */
export default function PageNotFound(): React.JSX.Element {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { can } = usePermissions();
  const { t } = useTranslation();

  const primaryLink = isAuthenticated ? ROUTES.home : ROUTES.login;
  const primaryLabel = isAuthenticated
    ? t("page.notFound.goDashboard")
    : t("page.notFound.goSignIn");

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-h-screen flex items-center justify-center p-6 bg-background"
    >
      <div className="max-w-md w-full">
        <div className="text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-7xl font-light text-muted-foreground/40">404</h1>
            <div className="h-0.5 w-16 bg-border mx-auto" aria-hidden />
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl font-medium text-foreground">{t("page.notFound.title")}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t("page.notFound.message", { path: location.pathname })}
            </p>
          </div>

          {isAuthenticated && can("users.manage") ? (
            <div className="mt-8 p-4 bg-muted/50 rounded-lg border border-border text-start">
              <p className="text-sm font-medium text-foreground">{t("page.notFound.adminNote")}</p>
              <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                {t("page.notFound.adminNoteBody")}
              </p>
            </div>
          ) : null}

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              asChild
              variant="outline"
              className="h-auto bg-card border-border font-medium transition-colors"
            >
              <Link to={primaryLink}>{primaryLabel}</Link>
            </Button>
            {isAuthenticated ? (
              <Button asChild variant="link" className="h-auto font-medium">
                <Link to={ROUTES.settings}>{t("page.notFound.openSettings")}</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
