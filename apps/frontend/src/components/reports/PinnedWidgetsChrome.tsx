import React, { useId } from "react";
import { LayoutDashboard, SlidersHorizontal } from "lucide-react";
import type { AppTranslationKey } from "@mms/shared";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { WORK_SURFACE } from "@/components/ui/formStyles";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

interface DashboardControlOptionProps {
  checked: boolean;
  onCheckedChange: () => void;
  labelKey: AppTranslationKey;
  descriptionKey: AppTranslationKey;
  t: TranslationFunction;
}

function DashboardControlOption({
  checked,
  onCheckedChange,
  labelKey,
  descriptionKey,
  t,
}: DashboardControlOptionProps): React.JSX.Element {
  const id = useId();
  return (
    <div className="flex items-start gap-3 p-3 rounded-2xl border border-border/50 bg-card/10 hover:bg-card/45 hover:border-primary/20 transition-all select-none">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="mt-0.5 cursor-pointer"
      />
      <label htmlFor={id} className="space-y-0.5 cursor-pointer flex-1">
        <p className="text-xs font-bold text-foreground">{t(labelKey)}</p>
        <p className="text-xs text-muted-foreground">{t(descriptionKey)}</p>
      </label>
    </div>
  );
}

interface PinnedWidgetsChromeProps {
  category: string;
  isBuilderOpen: boolean;
  disabledCardIds: string[];
  sectionSettings: Record<string, boolean>;
  toggleCardVisibility: (cardId: string) => void;
  toggleSectionSetting: (key: string) => void;
  onToggleBuilder: () => void;
  t: TranslationFunction;
}

export function PinnedWidgetsChrome({
  category,
  isBuilderOpen,
  disabledCardIds,
  sectionSettings,
  toggleCardVisibility,
  toggleSectionSetting,
  onToggleBuilder,
  t,
}: PinnedWidgetsChromeProps): React.JSX.Element {
  const showControls = [
    "students",
    "sessions",
    "attendance",
    "financial",
    "accounting",
    "hasanat",
  ].includes(category);

  return (
    <>
      <div
        className={`flex flex-col gap-3 p-4 ${WORK_SURFACE} select-none sm:flex-row sm:items-center sm:justify-between`}
      >
        <div className="flex min-w-0 items-center gap-2">
          <div className="w-10 h-10 shrink-0 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-foreground leading-none tracking-tight">
              {t("reports.widgets.title")}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 uppercase font-semibold tracking-wider font-sans">
              {t("reports.widgets.subtitle")}
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant={isBuilderOpen ? "capsPrimary" : "capsOutline"}
          size="caps"
          onClick={onToggleBuilder}
          className={`w-full sm:w-auto shrink-0 ${
            isBuilderOpen ? "shadow-lg shadow-primary/20" : ""
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          {isBuilderOpen ? t("reports.widgets.closeBuilder") : t("reports.widgets.createWidget")}
        </Button>
      </div>

      {showControls && (
        <div className={`p-5 space-y-4 ${WORK_SURFACE} select-none`}>
          <div>
            <SectionLabel as="h4" tone="foreground" className="leading-none">
              {t("reports.widgets.controlsTitle")}
            </SectionLabel>
            <SectionLabel as="p" weight="bold" tracking="wider" className="mt-1">
              {t("reports.widgets.controlsSubtitle")}
            </SectionLabel>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {category === "students" && (
              <>
                <DashboardControlOption
                  checked={!disabledCardIds.includes("students")}
                  onCheckedChange={() => toggleCardVisibility("students")}
                  labelKey="reports.widgets.studentsCard"
                  descriptionKey="reports.widgets.studentsCardDesc"
                  t={t}
                />
                <DashboardControlOption
                  checked={!!sectionSettings.enrollmentChart}
                  onCheckedChange={() => toggleSectionSetting("enrollmentChart")}
                  labelKey="reports.widgets.enrollmentChart"
                  descriptionKey="reports.widgets.enrollmentChartDesc"
                  t={t}
                />
              </>
            )}

            {category === "sessions" && (
              <>
                <DashboardControlOption
                  checked={!disabledCardIds.includes("sessions")}
                  onCheckedChange={() => toggleCardVisibility("sessions")}
                  labelKey="reports.widgets.sessionsCard"
                  descriptionKey="reports.widgets.sessionsCardDesc"
                  t={t}
                />
                <DashboardControlOption
                  checked={!disabledCardIds.includes("classes")}
                  onCheckedChange={() => toggleCardVisibility("classes")}
                  labelKey="reports.widgets.classesCard"
                  descriptionKey="reports.widgets.classesCardDesc"
                  t={t}
                />
                <DashboardControlOption
                  checked={!!sectionSettings.sessionsTable}
                  onCheckedChange={() => toggleSectionSetting("sessionsTable")}
                  labelKey="reports.widgets.sessionsTable"
                  descriptionKey="reports.widgets.sessionsTableDesc"
                  t={t}
                />
              </>
            )}

            {category === "attendance" && (
              <>
                <DashboardControlOption
                  checked={!disabledCardIds.includes("attendance")}
                  onCheckedChange={() => toggleCardVisibility("attendance")}
                  labelKey="reports.widgets.attendanceCard"
                  descriptionKey="reports.widgets.attendanceCardDesc"
                  t={t}
                />
                <DashboardControlOption
                  checked={!!sectionSettings.attendanceChart}
                  onCheckedChange={() => toggleSectionSetting("attendanceChart")}
                  labelKey="reports.widgets.attendanceChart"
                  descriptionKey="reports.widgets.attendanceChartDesc"
                  t={t}
                />
              </>
            )}

            {(category === "financial" || category === "finance" || category === "accounting") && (
              <>
                <DashboardControlOption
                  checked={!disabledCardIds.includes("fees")}
                  onCheckedChange={() => toggleCardVisibility("fees")}
                  labelKey="reports.widgets.feeCard"
                  descriptionKey="reports.widgets.feeCardDesc"
                  t={t}
                />
                <DashboardControlOption
                  checked={!disabledCardIds.includes("outstanding")}
                  onCheckedChange={() => toggleCardVisibility("outstanding")}
                  labelKey="reports.widgets.outstandingInvoicesCard"
                  descriptionKey="reports.widgets.outstandingInvoicesCardDesc"
                  t={t}
                />
                <DashboardControlOption
                  checked={!!sectionSettings.revenueChart}
                  onCheckedChange={() => toggleSectionSetting("revenueChart")}
                  labelKey="reports.widgets.revenueChart"
                  descriptionKey="reports.widgets.revenueChartDesc"
                  t={t}
                />
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
