import React from "react";
import { Link } from "react-router-dom";
import { PlatformLogoMark } from "@mms/ui";
import { useTranslation } from "@mms/fe-core/i18n";
import { ROUTES } from "@/lib/config/routes";
import { usePlatformBranding } from "@/platform/features/settings/hooks/usePlatformBranding";

export function PlatformHeaderBrand(): React.JSX.Element {
  const { t } = useTranslation();
  const { logoUrl } = usePlatformBranding();

  return (
    <Link
      to={ROUTES.home}
      aria-label={`${t("entry.productName")} ${t("platform.consoleTitle")}`}
      className="group flex min-h-11 min-w-11 items-center gap-3.5"
    >
      <PlatformLogoMark
        size="sm"
        src={logoUrl || undefined}
        className="h-10 w-10 border-primary/30 group-hover:scale-105 group-hover:shadow group-hover:border-primary/60 transition-all duration-300"
      />
      <div className="hidden min-w-0 flex-col text-start sm:flex">
        <span className="text-sm font-black tracking-wider uppercase text-foreground leading-none">
          {t("entry.productName")}
        </span>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mt-1">
          {t("platform.consoleTitle")}
        </span>
      </div>
    </Link>
  );
}
