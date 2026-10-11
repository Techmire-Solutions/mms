import React from "react";
import { ShieldCheck, Lock, ShieldAlert } from "lucide-react";
import { PlatformLogoMark } from "@/platform/components/PlatformPageShell";
import { AuthCardShell, AuthFormHeading, AuthPageFrame } from "@/components/entry";
import { useTranslation } from "@/hooks/useTranslation";
import { Badge } from "@/components/ui/badge";

export interface PlatformAuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  footer?: React.ReactNode;
}

/** Apex platform auth shell — product mark, apex badge, language selector & security trust indicators. */
export default function PlatformAuthLayout({
  children,
  title,
  subtitle,
  footer,
}: PlatformAuthLayoutProps): React.JSX.Element {
  const { t } = useTranslation();

  const combinedFooter = (
    <div className="space-y-4">
      {footer}
      <div className="pt-3 border-t border-border/40 text-center space-y-1.5">
        <div className="flex items-center justify-center gap-3 text-3xs font-semibold text-muted-foreground">
          <span className="flex items-center gap-1 text-primary">
            <Lock className="w-3 h-3 shrink-0" aria-hidden />
            {t("platform.authTrustTls")}
          </span>
          <span className="text-border">•</span>
          <span className="flex items-center gap-1 text-success">
            <ShieldCheck className="w-3 h-3 shrink-0" aria-hidden />
            {t("platform.authTrustRls")}
          </span>
        </div>
        <p className="text-2xs text-muted-foreground font-medium uppercase tracking-wider">
          {t("platform.consoleTitle")}
        </p>
      </div>
    </div>
  );

  return (
    <AuthPageFrame dir="ltr">
      <div className="relative z-elevated w-full max-w-md text-start">
        <AuthCardShell
          footer={combinedFooter}
          header={
            <div className="space-y-3.5 text-center">
              <PlatformLogoMark />

              <div className="flex justify-center">
                <Badge
                  tone="primary"
                  pill
                  size="lg"
                  className="font-black uppercase tracking-wider shadow-xs"
                >
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" aria-hidden />
                  {t("platform.consoleTitle")}
                </Badge>
              </div>

              <AuthFormHeading title={title} subtitle={subtitle} />
            </div>
          }
        >
          {children}
        </AuthCardShell>
      </div>
    </AuthPageFrame>
  );
}
