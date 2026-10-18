import React from "react";
import { useSearchParams } from "react-router-dom";
import { isValidSubdomain } from "@mms/shared";
import { getAppDomain } from "@/lib/config/tenantConfig";
import { useTranslation } from "@/hooks/useTranslation";
import EntryPageHead, { formatEntryTitle } from "@/components/entry/EntryPageHead";
import { AuthCardShell, AuthFormHeading, AuthMutedPanel, AuthPageFrame } from "@/components/entry";
import { PlatformLogoMark } from "@/platform/components/PlatformPageShell";

/**
 * Platform apex "Tenant Not Found" page.
 * Target of hard redirects from unregistered `{subdomain}.{domain}` hosts.
 * English/LTR via platform host lock — contact MMS platform administrator only.
 */
export default function TenantNotFoundPage(): React.JSX.Element {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const appDomain = getAppDomain();
  const rawSubdomain = searchParams.get("subdomain")?.trim() ?? "";
  const subdomain = isValidSubdomain(rawSubdomain) ? rawSubdomain : null;
  const hostLabel = subdomain ? `${subdomain}.${appDomain}` : null;

  return (
    <>
      <EntryPageHead
        title={formatEntryTitle(t("apex.workspaceNotFoundTitle"), t("entry.productName"))}
        description={t("entry.meta.workspaceNotFound")}
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
                title={t("apex.workspaceNotFoundTitle")}
                subtitle={
                  subdomain
                    ? t("apex.workspaceNotFoundMessage", {
                        subdomain,
                        domain: appDomain,
                      })
                    : t("entry.meta.workspaceNotFound")
                }
              />
            </div>
          }
        >
          <div className="space-y-4">
            {hostLabel ? (
              <AuthMutedPanel align="center" className="font-mono text-xs sm:text-sm">
                <span className="break-all text-foreground">{hostLabel}</span>
              </AuthMutedPanel>
            ) : null}
            <p className="text-center text-sm leading-relaxed text-muted-foreground">
              {t("apex.workspaceNotFoundContactAdmin")}
            </p>
          </div>
        </AuthCardShell>
      </AuthPageFrame>
    </>
  );
}
