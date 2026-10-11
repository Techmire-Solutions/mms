import React, { useState, useEffect } from "react";
import { GitCompare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { SubTabBar } from "@/components/ui/SubTabBar";
import { useTranslation } from "@/hooks/useTranslation";
import { ComparisonModeCharts } from "@/components/ui/reports/ComparisonModeCharts";
import { ComparisonModeSelectors } from "@/components/ui/reports/ComparisonModeSelectors";
import { useComparisonModeData } from "@/tenant/features/reports/controllers/useComparisonModeData";
import type { ComparisonModeProps, DateRange } from "@/components/ui/reports/comparisonModeTypes";
import { WORK_SURFACE } from "@/components/ui/formStyles";

/**
 * ComparisonMode component that displays side-by-side session or date range comparisons.
 *
 * @param props - Component props.
 * @returns React.JSX.Element
 */
export default function ComparisonMode({
  category,
  onClose,
}: ComparisonModeProps): React.JSX.Element {
  const { t, language } = useTranslation();

  const isContacts = category.toLowerCase() === "contacts";
  const currentYear = new Date().getFullYear();
  const [mode, setMode] = useState<"sessions" | "daterange">("sessions");
  const [valA, setValA] = useState<string>("s1");
  const [valB, setValB] = useState<string>("s2");
  const [rangeA, setRangeA] = useState<DateRange>(() => ({
    from: `${currentYear - 1}-01-01`,
    to: `${currentYear - 1}-03-31`,
  }));
  const [rangeB, setRangeB] = useState<DateRange>(() => ({
    from: `${currentYear}-01-01`,
    to: `${currentYear}-03-31`,
  }));
  const modeTabs = (() => [
    { key: "sessions" as const, label: t("reports.comparison.sessions") },
    { key: "daterange" as const, label: t("reports.comparison.dateRanges") },
  ])();

  const { sessionsOptions, comparisonData, labelA, labelB } = useComparisonModeData({
    category,
    isContacts,
    mode,
    valA,
    valB,
    rangeA,
    rangeB,
    language,
    t,
  });

  useEffect(() => {
    if (isContacts) {
      setMode("daterange");
    } else {
      setMode("sessions");
      setValA("s1");
      setValB("s2");
    }
  }, [category, isContacts]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className={`${WORK_SURFACE} overflow-hidden`}
    >
      <div className="flex flex-col gap-3 px-4 py-3 bg-primary/5 border-b border-border/50 text-start sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <GitCompare className="w-4 h-4 shrink-0 text-primary" />
          <span className="truncate text-sm font-bold text-foreground">
            {t("reports.comparison.title")}
          </span>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          {!isContacts && (
            <SubTabBar
              tabs={modeTabs}
              value={mode}
              onChange={setMode}
              panelIdPrefix="comparison-mode"
              className="min-w-0 flex-1"
            />
          )}
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="shrink-0 rounded-lg hover:bg-muted transition-colors"
            type="button"
            aria-label={t("reports.comparison.closeLabel")}
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <ComparisonModeSelectors
          mode={mode}
          isContacts={isContacts}
          valA={valA}
          valB={valB}
          setValA={setValA}
          setValB={setValB}
          rangeA={rangeA}
          rangeB={rangeB}
          setRangeA={setRangeA}
          setRangeB={setRangeB}
          options={sessionsOptions}
        />

        <ComparisonModeCharts
          mode={mode}
          translatedData={comparisonData}
          labelA={labelA}
          labelB={labelB}
          isContacts={isContacts}
        />
      </div>
    </motion.div>
  );
}
