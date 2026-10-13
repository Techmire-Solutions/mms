import { EnrollmentReportsWrapper } from "./EnrollmentReportsWrapper";
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

import StudentReport from "@/tenant/features/reports/components/StudentReport";
import ContactReport from "@/tenant/features/reports/components/ContactReport";
import AttendanceReport from "@/tenant/features/reports/components/AttendanceReport";
import FinancialReport from "@/tenant/features/reports/components/FinancialReport";
import AcademicReport from "@/tenant/features/reports/components/AcademicReport";
import HasanatReport from "@/tenant/features/reports/components/HasanatReport";
import SessionReport from "@/tenant/features/reports/components/SessionReport";
import FacultyReport from "@/tenant/features/reports/components/FacultyReport";
import QuestionBankReport from "@/tenant/features/reports/components/QuestionBankReport";
import { FinancialReports } from "@/tenant/components/reports/moduleReportAdapters";
import { ObligationsSummary } from "@/tenant/components/reports/moduleReportAdapters";
import MessagingReport from "@/tenant/features/reports/components/MessagingReport";
import UsersReport from "@/tenant/features/reports/components/UsersReport";

type ReportsToolsTab = "dashboard" | "compare" | "builder" | "visualizer" | "cardBuilder" | "saved";

interface ModuleReportsProps {
  category: ModuleReportCategory;
}

const MODULES_WITH_INTERNAL_FILTERS = new Set<ModuleReportCategory>([
  "contacts",
  "accounting",
  "obligations",
  "messaging",
  "users",
]);

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

  const renderReport = () => {
    switch (category) {
      case "students":
        return <StudentReport filters={filters} onEditVisual={handleEditVisual} />;
      case "faculty":
        return <FacultyReport filters={filters} onEditVisual={handleEditVisual} />;
      case "contacts":
        return <ContactReport onEditVisual={handleEditVisual} />;
      case "attendance":
        return <AttendanceReport filters={filters} onEditVisual={handleEditVisual} />;
      case "finance":
      case "financial":
        return <FinancialReport filters={filters} onEditVisual={handleEditVisual} />;
      case "accounting":
        return <FinancialReports />;
      case "obligations":
        return <ObligationsSummary />;
      case "enrollments":
        return <EnrollmentReportsWrapper filters={filters} />;
      case "messaging":
        return <MessagingReport />;
      case "users":
        return <UsersReport />;
      case "examinations":
        return <AcademicReport filters={filters} onEditVisual={handleEditVisual} />;
      case "questionBank":
        return <QuestionBankReport filters={filters} onEditVisual={handleEditVisual} />;
      case "hasanat":
        return <HasanatReport filters={filters} onEditVisual={handleEditVisual} />;
      case "sessions":
        return <SessionReport filters={filters} onEditVisual={handleEditVisual} />;
      case "saved":
        return null;
      default:
        return null;
    }
  };

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
        {!MODULES_WITH_INTERNAL_FILTERS.has(category) ? (
          <ReportFilters category={category} filters={filters} onChange={setFilters} />
        ) : null}
      </div>

      <div className="w-full">{renderReport()}</div>
    </section>
  );
}
