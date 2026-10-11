import React from "react";
import { Button } from "@/components/ui/button";
import { CompactSegmentedControl } from "@/components/ui/CompactSegmentedControl";
import { FormSelect } from "@/components/ui/FormSelect";
import { Input } from "@/components/ui/input";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { FORM_LABEL, FORM_INPUT_BUILDER } from "@/components/ui/formStyles";
import { useTranslation } from "@/hooks/useTranslation";

export {
  WidgetBuilderIconPicker,
  type WidgetBuilderIconTab,
} from "@/components/ui/reports/pinnedWidgets/WidgetBuilderIconPicker";

interface WidgetBuilderCardRoleOptionsProps {
  builderRole: string;
  setBuilderRole: (role: string) => void;
}

interface WidgetBuilderCardTextOptionsProps {
  subTextType: "fixed" | "dynamic";
  setSubTextType: (subTextType: "fixed" | "dynamic") => void;
  fixedSubText: string;
  setFixedSubText: (fixedSubText: string) => void;
  trend: number;
  setTrend: (trend: number) => void;
  trendType: "manual" | "database";
  setTrendType: (trendType: "manual" | "database") => void;
}

export function WidgetBuilderCardRoleOptions({
  builderRole,
  setBuilderRole,
}: WidgetBuilderCardRoleOptionsProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="space-y-1">
      <label htmlFor="builder-role" className={`${FORM_LABEL} block`}>
        {t("reports.widgets.builder.dashboardRole")}
      </label>
      <FormSelect
        id="builder-role"
        value={builderRole}
        onChange={setBuilderRole}
        options={[
          { value: "admin", label: t("reports.widgets.builder.roleAdmin") },
          { value: "teacher", label: t("reports.widgets.builder.roleTeacher") },
          { value: "accountant", label: t("reports.widgets.builder.roleAccountant") },
        ]}
      />
    </div>
  );
}

export function WidgetBuilderCardTextOptions({
  subTextType,
  setSubTextType,
  fixedSubText,
  setFixedSubText,
  trend,
  setTrend,
  trendType,
  setTrendType,
}: WidgetBuilderCardTextOptionsProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <>
      <div className="space-y-1">
        <label htmlFor="subtext-style" className={`${FORM_LABEL} block`}>
          {t("reports.widgets.builder.subtextStyle")}
        </label>
        <FormSelect
          id="subtext-style"
          value={subTextType}
          onChange={(val) => setSubTextType(val as "fixed" | "dynamic")}
          options={[
            { value: "dynamic", label: t("reports.widgets.builder.subtextDynamic") },
            { value: "fixed", label: t("reports.widgets.builder.subtextFixed") },
          ]}
        />
      </div>

      {subTextType === "fixed" && (
        <div className="space-y-1">
          <label htmlFor="fixed-subtitle" className={`${FORM_LABEL} block`}>
            {t("reports.widgets.builder.fixedSubtitle")}
          </label>
          <Input
            id="fixed-subtitle"
            type="text"
            value={fixedSubText}
            onChange={(event) => setFixedSubText(event.target.value)}
            placeholder={t("reports.widgets.builder.placeholderSubtitle")}
            className={FORM_INPUT_BUILDER}
          />
        </div>
      )}

      <div className="space-y-1 col-span-1 sm:col-span-2 border-t border-border/40 pt-3">
        <p className={`${FORM_LABEL} block`}>{t("reports.widgets.builder.trendSource")}</p>
        <CompactSegmentedControl
          tone="primary"
          ariaLabel={t("reports.widgets.builder.trendSource")}
          className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-sm bg-card/20"
          value={trendType}
          onChange={setTrendType}
          options={[
            { value: "database", label: t("reports.widgets.builder.sourceDb") },
            { value: "manual", label: t("reports.widgets.builder.sourceManual") },
          ]}
        />
      </div>

      <div className="space-y-1 col-span-1 sm:col-span-2">
        {trendType === "database" ? (
          <p className="text-xs text-muted-foreground italic leading-normal bg-primary/5 p-3 rounded-xl border border-primary/10">
            ⚡ {t("reports.widgets.builder.dynamicModeDesc")}
          </p>
        ) : (
          <>
            <div className="flex justify-between items-center select-none">
              <SectionLabel as="p" weight="bold" tracking="wider" className="block">
                {t("reports.widgets.builder.manualTrend")}
              </SectionLabel>
              <Badge
                pill
                tone={trend > 0 ? "success" : trend < 0 ? "destructive" : "muted"}
                className="px-1.5 font-black"
              >
                {trend > 0 ? "+" : ""}
                {trend}%
              </Badge>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <Slider
                min={-100}
                max={100}
                step={1}
                value={[trend]}
                onValueChange={(val) => setTrend(val[0] ?? 0)}
                className="flex-1 py-2"
                aria-label={t("reports.widgets.builder.manualTrend")}
              />
              <Button
                type="button"
                variant="capsOutline"
                size="caps"
                onClick={() => setTrend(0)}
                title={t("reports.widgets.builder.resetTrend")}
              >
                {t("reports.widgets.builder.reset")}
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
