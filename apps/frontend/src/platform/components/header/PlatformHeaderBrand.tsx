import React from "react";
import { Link } from "react-router-dom";
import { PlatformLogoMark } from "@shared/ui";
import { useTranslation } from "@/hooks/useTranslation";
import { ROUTES } from "@/lib/config/routes";

export function PlatformHeaderBrand(): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <Link to={ROUTES.home} className="group flex min-h-11 min-w-11 items-center gap-3.5">
      <PlatformLogoMark
        size="sm"
        className="h-10 w-10 border-primary/30 group-hover:scale-105 group-hover:shadow group-hover:border-primary/60 transition-all duration-300"
      />
      <div className="flex flex-col text-start">
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
