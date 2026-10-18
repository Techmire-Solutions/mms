import React from "react";
import { getAppDomain } from "@/lib/config/tenantConfig";
import { useTranslation } from "@/hooks/useTranslation";
import EntryPageHead, { formatEntryTitle } from "@/components/entry/EntryPageHead";
import {
  AuthCardShell,
  AuthFormHeading,
  AuthMutedPanel,
  AuthPageFrame,
  AuthStatusBanner,
} from "@/components/entry";
import { PlatformLogoMark } from "@/components/common/PlatformLogoMark";

interface WorkspaceDisabledScreenProps {
  madrasaName: string;
  subdomain: string;
}

/**
 * Disabled tenant host — platform-themed English status screen.
 * Theme/language are locked by RouterBridge + TranslationProvider.
 */
export default function WorkspaceDisabledScreen({
  madrasaName,
  subdomain,
}: WorkspaceDisabledScreenProps): React.JSX.Element {
  const { t } = useTranslation();
  const appDomain = getAppDomain();
  const hostLabel = `${subdomain}.${appDomain}`;

  return (
    <>
      <EntryPageHead
        title={formatEntryTitle(t("platform.workspaceDisabledTitle"), t("entry.productName"))}
        description={t("entry.meta.workspaceDisabled")}
      />
      <AuthPageFrame dir="ltr">
        <AuthCardShell
          className="max-w-md"
          header={
            <div className="space-y-4">
              <PlatformLogoMark />
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                {t("entry.productName")}
              </p>
              <AuthFormHeading
                title={t("platform.workspaceDisabledTitle")}
                subtitle={t("platform.workspaceDisabledMessage", {
                  name: madrasaName,
                  subdomain,
                  domain: appDomain,
                })}
              />
            </div>
          }
        >
          <div className="space-y-4">
            <AuthMutedPanel align="center" className="font-mono text-xs sm:text-sm">
              <span className="break-all text-foreground">{hostLabel}</span>
            </AuthMutedPanel>
            <AuthStatusBanner variant="warning" message={t("platform.contactSuperAdmin")} />
          </div>
        </AuthCardShell>
      </AuthPageFrame>
    </>
  );
}
