import React from "react";
import { Scan } from "lucide-react";
import { CompactSegmentedControl } from "@mms/ui/app/CompactSegmentedControl";
import { Badge } from "@mms/ui";
import { SEMANTIC_BADGE } from "@mms/fe-core/ui/semanticTone";
import { cn } from "@mms/ui";
import type { AttendanceSettings } from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
import { SectionCard } from "@mms/ui";
import { ToggleRow } from "@mms/ui";
import { SETUP_SECTION_CARD_CLASS } from "@mms/ui";

export interface AttendanceAdvancedRulesSectionProps {
  settingsDraft: AttendanceSettings;
  upd: <K extends keyof AttendanceSettings>(key: K, value: AttendanceSettings[K]) => void;
  isPrefsDirty?: boolean;
  saving?: boolean;
  saved?: boolean;
  onSave?: () => void | Promise<void>;
}

export function AttendanceAdvancedRulesSection({
  settingsDraft,
  upd,
}: AttendanceAdvancedRulesSectionProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <SectionCard
      accentColor="success"
      icon={Scan}
      title={t("attendance.settings.advanced")}
      className={SETUP_SECTION_CARD_CLASS}
    >
      <div className="space-y-3">
        <ToggleRow
          label={t("attendance.settings.offlineMode")}
          description={t("attendance.settings.offlineModeDesc")}
          value={Boolean(settingsDraft.offlineEnabled)}
          onChange={(value) => upd("offlineEnabled", value)}
        />
        <ToggleRow
          label={t("attendance.settings.geoTagging")}
          description={t("attendance.settings.geoTaggingDesc")}
          value={Boolean(settingsDraft.geoTagging)}
          onChange={(value) => upd("geoTagging", value)}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
          <div className="min-w-0">
            <p className="m-0 text-sm font-semibold text-foreground">
              {t("attendance.settings.defaultLayout")}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("attendance.settings.defaultLayoutDesc")}
            </p>
          </div>
          <CompactSegmentedControl
            value={
              ((settingsDraft.defaultViewLayout as string | undefined) || "list") as
                "list" | "cards"
            }
            onChange={(value) => upd("defaultViewLayout", value)}
            options={[
              { value: "list", label: t("attendance.settings.listView") },
              { value: "cards", label: t("attendance.settings.cardGrid") },
            ]}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
          <div className="min-w-0">
            <p className="m-0 text-sm font-semibold text-foreground">
              {t("attendance.settings.facialRecognition")}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("attendance.settings.facialRecognitionDesc")}
            </p>
          </div>
          <Badge
            pill
            variant="outline"
            className={cn("px-2 font-bold", SEMANTIC_BADGE.warningStrong)}
          >
            {t("attendance.settings.comingSoon")}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
          <div className="min-w-0">
            <p className="m-0 text-sm font-semibold text-foreground">
              {t("attendance.settings.auditLogging")}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("attendance.settings.auditLoggingDesc")}
            </p>
          </div>
          <Badge
            pill
            variant="outline"
            className={cn("px-2 font-bold", SEMANTIC_BADGE.successStrong)}
          >
            {t("attendance.settings.active")}
          </Badge>
        </div>
      </div>
    </SectionCard>
  );
}
