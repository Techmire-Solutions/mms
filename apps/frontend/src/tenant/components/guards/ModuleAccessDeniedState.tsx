import React from "react";
import { Link } from "react-router-dom";
import { Lock, PackageX, PowerOff, RefreshCw, ShieldAlert, type LucideIcon } from "lucide-react";
import type { AppTranslationKey, ModuleAccessDenialCode } from "@mms/shared";
import { Button } from "@/components/ui/button";
import { FeedbackStateLayout } from "@/components/ui/FeedbackStateLayout";
import { ROUTES } from "@/lib/config/routes";
import { useTranslation } from "@/hooks/useTranslation";

interface DenialCopy {
  icon: LucideIcon;
  titleKey: AppTranslationKey;
  descriptionKey: AppTranslationKey;
}

const DENIAL_COPY: Record<ModuleAccessDenialCode, DenialCopy> = {
  MODULE_NOT_GRANTED: {
    icon: PackageX,
    titleKey: "errors.route.moduleUnavailableTitle",
    descriptionKey: "errors.route.moduleUnavailable",
  },
  MODULE_DISABLED: {
    icon: PowerOff,
    titleKey: "errors.route.moduleDisabledTitle",
    descriptionKey: "errors.route.moduleDisabled",
  },
  PERMISSION_DENIED: {
    icon: Lock,
    titleKey: "errors.route.forbiddenTitle",
    descriptionKey: "errors.route.forbidden",
  },
  MODULE_ACCESS_UNAVAILABLE: {
    icon: ShieldAlert,
    titleKey: "errors.route.accessCheckFailedTitle",
    descriptionKey: "errors.route.accessCheckFailed",
  },
};

export interface ModuleAccessDeniedStateProps {
  code: ModuleAccessDenialCode;
  /** Only when the viewer can manage modules and the module is granted (so it can be re-enabled). */
  showModuleSettingsLink?: boolean;
  onRetry?: () => void;
}

/** Full-panel state shown in place of a module page the viewer cannot open. */
export function ModuleAccessDeniedState({
  code,
  showModuleSettingsLink = false,
  onRetry,
}: ModuleAccessDeniedStateProps): React.JSX.Element {
  const { t } = useTranslation();
  const { icon: Icon, titleKey, descriptionKey } = DENIAL_COPY[code];

  const action = onRetry ? (
    <Button type="button" variant="outline" onClick={onRetry} className="min-h-11 gap-2">
      <RefreshCw className="size-4" aria-hidden="true" />
      {t("common.tryAgain")}
    </Button>
  ) : showModuleSettingsLink ? (
    <Button asChild variant="outline" className="min-h-11">
      <Link to={ROUTES.settings} state={{ settingsTab: "modules" }}>
        {t("errors.route.openModuleSettings")}
      </Link>
    </Button>
  ) : undefined;

  return (
    <FeedbackStateLayout
      role={onRetry ? "alert" : "status"}
      title={t(titleKey)}
      description={t(descriptionKey)}
      action={action}
      icon={
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-warning/10">
          <Icon className="size-7 text-warning" aria-hidden="true" />
        </div>
      }
    />
  );
}
