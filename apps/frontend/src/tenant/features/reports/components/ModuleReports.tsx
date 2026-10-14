import React, { useState } from "react";
import { BarChart2, GitCompare, Wrench, Sparkles, CreditCard, Bookmark } from "lucide-react";

import { useTranslation } from "@/hooks/useTranslation";
import { FormSelect } from "@/components/app/FormSelect";
import { WORK_SURFACE } from "@/components/ui/formStyles";
import { type SubTab, SubTabBar } from "@/components/app/SubTabBar";
import { scrollDocumentToTop } from "@/lib/routing/scrollDocumentToTop";
import ReportFilters, {
  type ReportFilterFields,
} from "@/tenant/features/reports/components/ReportFilters";
import { type VisualizerConfig } from "@/lib/reports/reportMetadata";
import {
  ModuleReportsToolPanels,
  getInitialReportCollection,
  type ModuleReportCategory,
} from "@/tenant/features/reports/components/ModuleReportsToolPanels";
import { MODULE_REPORT_REGISTRY } from "@/tenant/features/reports/components/moduleReportRegistry";

type ReportsToolsTab = "dashboard" | "compare" | "builder" | "visualizer" | "cardBuilder" | "saved";

interface ModuleReportsProps {
  category: ModuleReportCategory;
}

const DEFAULT_FILTERS: ReportFilterFields = {
  session: "all",
  class: "all",
  status: "all",
  dateFrom: "",
  dateTo: "",
  student: "",
};

/**
 * Reusable reporting view for specific modules.
 */
export default function ModuleReports({ category }: ModuleReportsProps) {
  const { t } = useTranslation();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [activeTab, setActiveTab] = useState<ReportsToolsTab>("dashboard");
  const [visualizerEditConfig, setVisualizerEditConfig] = useState<VisualizerConfig | undefined>(
    undefined,
  );

  const REPORT_TABS = (() => [
    { key: "dashboard", label: t("dashboard.title"), icon: BarChart2 },
    { key: "compare", label: t("reports.moduleTools.compare"), icon: GitCompare },
    { key: "builder", label: t("reports.moduleTools.reportBuilder"), icon: Wrench },
    { key: "visualizer", label: t("reports.moduleTools.visualizerBuilder"), icon: Sparkles },
    { key: "cardBuilder", label: t("reports.moduleTools.cardBuilder"), icon: CreditCard },
    { key: "saved", label: t("reports.saved.title"), icon: Bookmark },
  ])() as readonly SubTab<ReportsToolsTab>[];

  const toolSelectOptions = (() =>
    REPORT_TABS.map((tab) => ({ value: tab.key, label: tab.label })))();

  const handleEditVisual = (config: unknown) => {
    setVisualizerEditConfig(config as VisualizerConfig);
    setActiveTab("visualizer");
    scrollDocumentToTop({ behavior: "smooth" });
  };

  const reportEntry = MODULE_REPORT_REGISTRY[category];

  const renderReport = () => reportEntry.render({ filters, onEditVisual: handleEditVisual });

  return (
    <section aria-label={t("reports.aria.root")} className="space-y-6">
      <div
        className={`${WORK_SURFACE} flex items-center justify-between gap-4 flex-wrap p-4 rounded-3xl print:hidden`}
      >
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
            <BarChart2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-foreground leading-none tracking-tight">
              {t("reports.moduleTools.title")}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 uppercase font-bold tracking-widest">
              {t("reports.moduleTools.subtitle")}
            </p>
          </div>
        </div>

        <div className="w-full min-w-0 lg:hidden">
          <FormSelect
            id="reports-tools-mobile"
            value={activeTab}
            onChange={(next) => setActiveTab(next as ReportsToolsTab)}
            options={toolSelectOptions}
            aria-label={t("reports.moduleTools.title")}
          />
        </div>

        <div className="hidden w-full lg:block lg:w-auto">
          <SubTabBar
            tabs={REPORT_TABS}
            value={activeTab}
            onChange={setActiveTab}
            panelIdPrefix="reports-tools"
            className="w-full lg:w-auto"
          />
        </div>
      </div>

      <ModuleReportsToolPanels
        category={category}
        activeTab={activeTab}
        filters={filters}
        visualizerEditConfig={visualizerEditConfig}
        onClosePanel={() => setActiveTab("dashboard")}
        onApplySavedFilters={(appliedFilters) => {
          setFilters((prev) => ({
            ...prev,
            ...(appliedFilters as Partial<ReportFilterFields>),
          }));
          setActiveTab("dashboard");
        }}
        onVisualizerSave={() => {
          setActiveTab("dashboard");
          setVisualizerEditConfig(undefined);
        }}
        onVisualizerClose={() => {
          setActiveTab("dashboard");
          setVisualizerEditConfig(undefined);
        }}
        getInitialCollection={() => getInitialReportCollection(category)}
      />

      <div className="print:hidden">
        {!reportEntry.hasInternalFilters ? (
          <ReportFilters category={category} filters={filters} onChange={setFilters} />
        ) : null}
      </div>

      <div className="w-full">{renderReport()}</div>
    </section>
  );
}
