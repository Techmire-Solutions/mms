import React from "react";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/app/SectionLabel";
import { useTranslation } from "@/hooks/useTranslation";
import type { CustomWidget } from "@/lib/reports/pinnedWidgetTypes";

interface WidgetBuilderTypeSelectorProps {
  builderCollection: CustomWidget["collection"];
  widgetType: CustomWidget["widgetType"];
  setWidgetType: (widgetType: CustomWidget["widgetType"]) => void;
  setBuilderOperation: (builderOperation: CustomWidget["operation"]) => void;
}

interface WidgetTypeOption {
  id: NonNullable<CustomWidget["widgetType"]>;
  label: string;
  desc: string;
}

export function WidgetBuilderTypeSelector({
  builderCollection,
  widgetType,
  setWidgetType,
  setBuilderOperation,
}: WidgetBuilderTypeSelectorProps): React.JSX.Element {
  const { t } = useTranslation();
  const widgetTypeOptions: WidgetTypeOption[] = [
    {
      id: "card",
      label: t("reports.widgets.builder.typeCard"),
      desc: t("reports.widgets.builder.typeCardDesc"),
    },
    {
      id: "kpi",
      label: t("reports.widgets.builder.typeKpi"),
      desc: t("reports.widgets.builder.typeKpiDesc"),
    },
    {
      id: "progress",
      label: t("reports.widgets.builder.typeProgress"),
      desc: t("reports.widgets.builder.typeProgressDesc"),
    },
    {
      id: "switch",
      label: t("reports.widgets.builder.typeSwitch"),
      desc: t("reports.widgets.builder.typeSwitchDesc"),
    },
  ];

  if (builderCollection === "sessions") {
    widgetTypeOptions.push({
      id: "sessions-list",
      label: t("reports.widgets.builder.typeSessionsList"),
      desc: t("reports.widgets.builder.typeSessionsListDesc"),
    });
  } else if (builderCollection === "attendance_records") {
    widgetTypeOptions.push(
      {
        id: "attendance-summary",
        label: t("reports.widgets.builder.typeAttendanceSummary"),
        desc: t("reports.widgets.builder.typeAttendanceSummaryDesc"),
      },
      {
        id: "attendance-rate",
        label: t("reports.widgets.builder.typeAttendanceRate"),
        desc: t("reports.widgets.builder.typeAttendanceRateDesc"),
      },
    );
  } else if (builderCollection === "finance_invoices") {
    widgetTypeOptions.push(
      {
        id: "fee-summary",
        label: t("reports.widgets.builder.typeFeeSummary"),
        desc: t("reports.widgets.builder.typeFeeSummaryDesc"),
      },
      {
        id: "outstanding-list",
        label: t("reports.widgets.builder.typeOutstandingList"),
        desc: t("reports.widgets.builder.typeOutstandingListDesc"),
      },
      {
        id: "overdue-obligations",
        label: t("reports.widgets.builder.typeOverdueObligations"),
        desc: t("reports.widgets.builder.typeOverdueObligationsDesc"),
      },
      {
        id: "revenue-expenses",
        label: t("reports.widgets.builder.typeRevenueExpenses"),
        desc: t("reports.widgets.builder.typeRevenueExpensesDesc"),
      },
    );
  } else if (builderCollection === "students") {
    widgetTypeOptions.push({
      id: "enrollment-trends",
      label: t("reports.widgets.builder.typeEnrollmentTrends"),
      desc: t("reports.widgets.builder.typeEnrollmentTrendsDesc"),
    });
  } else if (builderCollection === "hasanat_distributions") {
    widgetTypeOptions.push({
      id: "hasanat-distribution",
      label: t("reports.widgets.builder.typeHasanatDistribution"),
      desc: t("reports.widgets.builder.typeHasanatDistributionDesc"),
    });
  }

  return (
    <div className="space-y-1.5">
      <SectionLabel as="p" toneClassName="text-foreground" tracking="wider" className="block">
        {t("reports.widgets.builder.focusType")}
      </SectionLabel>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {widgetTypeOptions.map((widgetTypeOption) => {
          const isSelectedType = widgetType === widgetTypeOption.id;
          return (
            <Button
              key={widgetTypeOption.id}
              type="button"
              variant="outline"
              onClick={() => {
                setWidgetType(widgetTypeOption.id);
                if (widgetTypeOption.id === "switch") {
                  setBuilderOperation("count");
                }
              }}
              className={`h-auto p-3 rounded-2xl border text-start flex flex-col justify-between transition-all shadow-none ${
                isSelectedType
                  ? "border-primary bg-primary/10 text-primary shadow-sm"
                  : "border-border bg-card/30 text-muted-foreground hover:border-muted-foreground/20"
              }`}
            >
              <span className="text-xs font-black uppercase block">{widgetTypeOption.label}</span>
              <span className="text-xs text-muted-foreground block mt-1 leading-none">
                {widgetTypeOption.desc}
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
