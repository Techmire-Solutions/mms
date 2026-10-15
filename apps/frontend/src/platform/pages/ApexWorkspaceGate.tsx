import React from "react";
import { Link } from "react-router-dom";
import { Globe, Shield } from "lucide-react";
import type { AppTranslationKey } from "@mms/shared";
import WorkspaceRegistryList from "@/platform/components/WorkspaceRegistryList";
import {
  AuthBackLink,
  AuthCardShell,
  AuthPageFrame,
  AuthStatusHeader,
  EntryPageHead,
  formatEntryTitle,
} from "@/components/entry";
import { ROUTES } from "@/lib/config/routes";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@shared/ui";

export type ApexGateVariant = "forgotPassword" | "twoFactor" | "tenantOnly";

const TITLE_KEYS: Record<ApexGateVariant, AppTranslationKey> = {
  forgotPassword: "apex.gateForgotTitle",
  twoFactor: "apex.gateTwoFactorTitle",
  tenantOnly: "apex.gateTenantOnlyTitle",
};

const MESSAGE_KEYS: Record<ApexGateVariant, AppTranslationKey> = {
  forgotPassword: "apex.gateForgotMessage",
  twoFactor: "apex.gateTwoFactorMessage",
  tenantOnly: "apex.gateTenantOnlyMessage",
};

const META_DESC_KEYS: Record<ApexGateVariant, AppTranslationKey> = {
  forgotPassword: "entry.meta.apexGateForgot",
  twoFactor: "entry.meta.apexGateTwoFactor",
  tenantOnly: "entry.meta.apexGateTenantOnly",
};

interface ApexWorkspaceGateProps {
  variant?: ApexGateVariant;
  showWorkspaceList?: boolean;
}

/**
 * Shown on the apex domain when the user hits a tenant-only route (login, app modules).
 */
export default function ApexWorkspaceGate({
  variant = "tenantOnly",
  showWorkspaceList = true,
}: ApexWorkspaceGateProps): React.JSX.Element {
  const { t } = useTranslation();
  const isForgotPicker = variant === "forgotPassword";
  const gateTitle = t(TITLE_KEYS[variant]);

  return (
    <>
      <EntryPageHead
        title={formatEntryTitle(gateTitle, t("entry.productName"))}
        description={t(META_DESC_KEYS[variant])}
      />
      <AuthPageFrame dir="ltr">
        <AuthCardShell
          className="max-w-lg"
          header={
            <AuthStatusHeader
              icon={Globe}
              title={gateTitle}
              description={t(MESSAGE_KEYS[variant])}
            />
          }
        >
          <div className="space-y-5">
            {showWorkspaceList ? (
              <WorkspaceRegistryList
                destinationPath={isForgotPicker ? ROUTES.forgotPassword : ROUTES.login}
                actionLabelKey={isForgotPicker ? "apex.resetPasswordAt" : "auth.signInTo"}
              />
            ) : null}

            {variant === "forgotPassword" ? (
              <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-start">
                <p className="text-sm text-muted-foreground">{t("apex.platformAdminHint")}</p>
                <Button asChild variant="default" className="h-11 w-full rounded-xl">
                  <Link to={ROUTES.platformForgotPassword}>
                    <Shield className="h-4 w-4" aria-hidden />
                    {t("apex.platformAdminForgot")}
                  </Link>
                </Button>
              </div>
            ) : null}

            <AuthBackLink to={ROUTES.home} label={t("apex.backToMain")} />
          </div>
        </AuthCardShell>
      </AuthPageFrame>
    </>
  );
}
