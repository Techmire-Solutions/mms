import React from "react";
import { motion } from "framer-motion";
import { X, Sliders } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/app/SectionLabel";
import { WORK_SURFACE } from "@/components/ui/formStyles";
import { useTranslation } from "@/hooks/useTranslation";
import { CustomReportBuilderConfigPanel } from "@/components/reports/CustomReportBuilderConfigPanel";
import { CustomReportBuilderPreviewPanel } from "@/components/reports/CustomReportBuilderPreviewPanel";
import { useCustomReportBuilderState } from "@/tenant/features/reports/hooks/useCustomReportBuilderState";

/** Props for the CustomReportBuilder component. */
interface CustomReportBuilderProps {
  /** Callback invoked when the user closes the builder panel. */
  onClose: () => void;
  /** Optional initial data source to select. */
  initialSource?: string;
}

export default function CustomReportBuilder({
  onClose,
  initialSource,
}: CustomReportBuilderProps): React.JSX.Element {
  const { t } = useTranslation();
  const {
    reportName,
    setReportName,
    source,
    setSource,
    selectedFields,
    setSelectedFields,
    aggregate,
    setAggregate,
    groupBy,
    setGroupBy,
    orientation,
    setOrientation,
    pageSize,
    setPageSize,
    previewData,
    available,
    resolveFieldLabel,
    addField,
    removeField,
    moveUp,
    moveDown,
  } = useCustomReportBuilderState(initialSource);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className={`${WORK_SURFACE} overflow-hidden text-start`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5 border-b border-border/50 bg-card/30">
        <div className="flex min-w-0 items-center gap-3">
          <div className="w-10 h-10 shrink-0 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
            <Sliders className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-black text-foreground uppercase tracking-wider leading-none">
              {t("reports.builder.title")}
            </h3>
            <SectionLabel as="p" weight="bold" tracking="wider" className="mt-1">
              {t("reports.builder.subtitle")}
            </SectionLabel>
          </div>
        </div>
        <Button
          onClick={onClose}
          variant="ghost"
          size="icon"
          className="shrink-0 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          type="button"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <CustomReportBuilderConfigPanel
          reportName={reportName}
          setReportName={setReportName}
          source={source}
          setSource={setSource}
          selectedFields={selectedFields}
          setSelectedFields={setSelectedFields}
          availableFields={available}
          addField={addField}
          aggregate={aggregate}
          setAggregate={setAggregate}
          groupBy={groupBy}
          setGroupBy={setGroupBy}
          orientation={orientation}
          setOrientation={setOrientation}
          pageSize={pageSize}
          setPageSize={setPageSize}
          resolveFieldLabel={resolveFieldLabel}
        />
        <CustomReportBuilderPreviewPanel
          selectedFields={selectedFields}
          setSelectedFields={setSelectedFields}
          previewData={previewData}
          aggregate={aggregate}
          groupBy={groupBy}
          reportName={reportName}
          orientation={orientation}
          pageSize={pageSize}
          removeField={removeField}
          moveUp={moveUp}
          moveDown={moveDown}
          resolveFieldLabel={resolveFieldLabel}
        />
      </div>
    </motion.div>
  );
}
