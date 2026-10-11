import React from "react";
import { Sparkles, School, BookOpen, GraduationCap } from "lucide-react";
import { SYSTEM_MODULES } from "@mms/shared";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";

export interface PlatformModulePresetsBarProps {
  onApplyPreset: (moduleIds: string[]) => void;
  disabled?: boolean;
}

export function PlatformModulePresetsBar({
  onApplyPreset,
  disabled = false,
}: PlatformModulePresetsBarProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-2xl bg-muted/40 border border-border/50 text-start">
      <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
        <Sparkles className="w-3.5 h-3.5 text-primary" aria-hidden />
        <span>{t("onboarding.presetsLabel")}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          icon={School}
          disabled={disabled}
          onClick={() => onApplyPreset(SYSTEM_MODULES.map((m) => m.id))}
        >
          {t("onboarding.presetFull")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          icon={BookOpen}
          disabled={disabled}
          onClick={() =>
            onApplyPreset([
              "dashboard",
              "contacts",
              "messaging",
              "students",
              "faculty",
              "attendance",
              "hasanat",
              "users",
            ])
          }
        >
          {t("onboarding.presetHifz")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          icon={GraduationCap}
          disabled={disabled}
          onClick={() =>
            onApplyPreset([
              "dashboard",
              "contacts",
              "messaging",
              "students",
              "attendance",
              "finance",
              "users",
            ])
          }
        >
          {t("onboarding.presetWeekend")}
        </Button>
      </div>
    </div>
  );
}
