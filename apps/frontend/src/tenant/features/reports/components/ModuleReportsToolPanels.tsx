import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import CustomReportBuilder from "@/tenant/features/reports/components/CustomReportBuilder";
import ComparisonMode from "@/tenant/features/reports/components/ComparisonMode";
import DynamicChartVisualizer from "@/tenant/features/reports/components/DynamicChartVisualizer";
import DynamicCardBuilder from "@/tenant/features/reports/components/DynamicCardBuilder";
import SavedReports from "@/components/reports/SavedReports";
import ContactsSavedReports from "@/tenant/features/reports/components/ContactsSavedReports";
import { getObject, saveObject } from "@/lib/db";
import { type VisualizerConfig } from "@/lib/reports/reportMetadata";
import { useGenericSavedReportsSource } from "@/hooks/useSavedReportsSource";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import { GENERIC_SAVED_REPORT_CATEGORIES, type GenericSavedReportCategory } from "@mms/shared";

export type ModuleReportCategory =
  | "students"
  | "contacts"
  | "attendance"
  | "finance"
  | "financial"
  | "accounting"
  | "enrollments"
  | "obligations"
  | "users"
  | "messaging"
  | "examinations"
  | "questionBank"
  | "hasanat"
  | "sessions"
  | "faculty"
  | "saved";

type ReportToolsTab = "dashboard" | "compare" | "builder" | "visualizer" | "cardBuilder" | "saved";

interface ModuleReportsToolPanelsProps {
  category: ModuleReportCategory;
  activeTab: ReportToolsTab;
  filters: Record<string, unknown>;
  visualizerEditConfig: VisualizerConfig | undefined;
  onClosePanel: () => void;
  onApplySavedFilters: (filters: Record<string, unknown>) => void;
  onVisualizerSave: (config: VisualizerConfig) => void;
  onVisualizerClose: () => void;
  getInitialCollection: () => ReturnType<typeof getInitialReportCollection>;
}

export function getInitialReportCollection(category: ModuleReportCategory) {
  switch (category) {
    case "students":
      return "students" as const;
    case "faculty":
      return "faculty" as const;
    case "sessions":
      return "sessions" as const;
    case "finance":
    case "financial":
    case "accounting":
      return "finance_invoices" as const;
    case "attendance":
      return "attendance_records" as const;
    case "hasanat":
      return "hasanat_distributions" as const;
    case "contacts":
      return "contacts" as const;
    case "questionBank":
      return "questions" as const;
    case "examinations":
      return "assessment_results" as const;
    case "enrollments":
      return "enrollments" as const;
    case "obligations":
      return "finance_invoices" as const;
    case "messaging":
    case "users":
      return "contacts" as const;
    default:
      return undefined;
  }
}

function isGenericSavedReportCategory(
  category: ModuleReportCategory,
): category is GenericSavedReportCategory {
  return (GENERIC_SAVED_REPORT_CATEGORIES as readonly string[]).includes(category);
}

function GenericSavedReportsPanel({
  category,
  filters,
  onApplyFilters,
}: {
  category: GenericSavedReportCategory;
  filters: Record<string, unknown>;
  onApplyFilters: (filters: Record<string, unknown>) => void;
}): React.JSX.Element {
  const source = useGenericSavedReportsSource(category);
  return (
    <SavedReports
      category={category}
      source={source}
      filters={filters}
      onApplyFilters={onApplyFilters}
    />
  );
}

export function ModuleReportsToolPanels({
  category,
  activeTab,
  filters,
  visualizerEditConfig,
  onClosePanel,
  onApplySavedFilters,
  onVisualizerSave,
  onVisualizerClose,
  getInitialCollection,
}: ModuleReportsToolPanelsProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <AnimatePresence mode="wait">
      {activeTab === "compare" && (
        <motion.div
          key="compare"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden"
        >
          <div className="pb-4">
            <ComparisonMode category={category} onClose={onClosePanel} />
          </div>
        </motion.div>
      )}
      {activeTab === "builder" && (
        <motion.div
          key="builder"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden"
        >
          <div className="pb-4">
            <CustomReportBuilder initialSource={category} onClose={onClosePanel} />
          </div>
        </motion.div>
      )}
      {activeTab === "visualizer" && (
        <motion.div
          key="visualizer"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden"
        >
          <div className="pb-4">
            <DynamicChartVisualizer
              initialConfig={visualizerEditConfig}
              onSave={(updatedConfig) => {
                try {
                  const customVisuals = getObject<Record<string, VisualizerConfig>>(
                    "report_custom_visuals",
                    {},
                  );
                  customVisuals[updatedConfig.id] = updatedConfig;
                  saveObject("report_custom_visuals", customVisuals);
                  window.dispatchEvent(new Event("local-database-update"));
                  onVisualizerSave(updatedConfig);
                } catch (error) {
                  notify.error(t("reports.visualizer.saveFailed"), {
                    description: error instanceof Error ? error.message : undefined,
                  });
                }
              }}
              onClose={onVisualizerClose}
            />
          </div>
        </motion.div>
      )}
      {activeTab === "cardBuilder" && (
        <motion.div
          key="cardBuilder"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden"
        >
          <div className="pb-4">
            <DynamicCardBuilder initialCollection={getInitialCollection()} />
          </div>
        </motion.div>
      )}
      {activeTab === "saved" && (
        <motion.div
          key="saved"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden"
        >
          <div className="pb-4">
            {category === "contacts" ? (
              <ContactsSavedReports />
            ) : isGenericSavedReportCategory(category) ? (
              <GenericSavedReportsPanel
                category={category}
                filters={filters}
                onApplyFilters={onApplySavedFilters}
              />
            ) : null}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
