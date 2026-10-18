import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Filter, ChevronDown, ChevronUp, X } from "lucide-react";
import { useSessionsCollection } from "@/tenant/hooks/collections/sessions";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WORK_SURFACE } from "@/components/ui/formStyles";
import { ReportFilterFieldsPanel } from "@/components/reports/ReportFilterFieldsPanel";
import type {
  ReportFilterFields,
  ReportFilterFieldKey,
} from "@/components/reports/reportFilterTypes";

export type { ReportFilterFields };

interface ReportFiltersProps {
  category: string;
  filters: ReportFilterFields;
  onChange: (filters: ReportFilterFields) => void;
}

const CATEGORY_FILTERS: Record<string, ReportFilterFieldKey[]> = {
  attendance: ["session", "class", "dateFrom", "dateTo", "student"],
  students: ["session", "class", "status", "student"],
  faculty: ["session", "class", "status", "student"],
  /** Handled by internal/dedicated module filters or CRM analytics. */
  contacts: [],
  finance: ["session", "dateFrom", "dateTo", "status"],
  financial: ["session", "dateFrom", "dateTo", "status"],
  academic: ["session", "class", "status", "student"],
  examinations: ["session", "class", "status", "student"],
  hasanat: ["session", "class", "dateFrom", "dateTo"],
  sessions: ["status"],
  enrollments: ["session", "status", "dateFrom", "dateTo"],
  questionBank: ["status", "dateFrom", "dateTo"],
  accounting: [],
  obligations: [],
  messaging: [],
  users: [],
};

export default function ReportFilters({
  category,
  filters,
  onChange,
}: ReportFiltersProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const [open, setOpen] = useState<boolean>(true);
  const rawSessions = useSessionsCollection();
  const allowed = CATEGORY_FILTERS[category] || [
    "session",
    "class",
    "status",
    "dateFrom",
    "dateTo",
    "student",
  ];

  const sessions = (() => {
    return [
      { id: "all", name: t("reports.filters.allSessions") },
      ...rawSessions.map((session) => ({ id: session.id, name: session.name })),
    ];
  })();

  const classes = (() => {
    const uniqueClasses = new Set<string>();
    rawSessions.forEach((session) =>
      (session.classes || []).forEach((sessionClass) => uniqueClasses.add(sessionClass.name)),
    );
    return [
      { id: "all", name: t("reports.filters.allClasses") },
      ...Array.from(uniqueClasses).map((name) => ({ id: name, name })),
    ];
  })();

  if (allowed.length === 0) {
    return null;
  }

  const set = (key: keyof ReportFilterFields, value: string): void => {
    onChange({ ...filters, [key]: value });
  };

  const activeCount = [
    filters.session !== "all",
    filters.class !== "all",
    filters.status !== "all",
    !!(filters.dateFrom || filters.dateTo),
    !!filters.student,
  ].filter(Boolean).length;

  const reset = (): void => {
    onChange({
      session: "all",
      class: "all",
      status: "all",
      dateFrom: "",
      dateTo: "",
      student: "",
    });
  };

  return (
    <div className={WORK_SURFACE}>
      <div className="w-full flex min-h-11 items-center justify-between gap-2 px-4 py-3 hover:bg-muted/50 transition-colors">
        <Button
          onClick={() => setOpen((isOpen) => !isOpen)}
          className="min-h-11 h-auto flex-1 min-w-0 justify-start gap-2 px-1 rounded-none hover:bg-transparent shadow-none"
          variant="ghost"
          type="button"
          aria-expanded={open}
        >
          <Filter className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="text-sm font-semibold text-foreground truncate">
            {t("reports.filters.title")}
          </span>
          {activeCount > 0 && (
            <Badge pill className="px-1.5 font-bold">
              {activeCount}
            </Badge>
          )}
        </Button>
        <div className="flex shrink-0 items-center gap-1">
          {activeCount > 0 && (
            <Button
              onClick={reset}
              className="min-h-11 px-2 text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1 shadow-none"
              variant="ghost"
              type="button"
            >
              <X className="w-3 h-3" aria-hidden="true" /> {t("reports.filters.clearAll")}
            </Button>
          )}
          <Button
            onClick={() => setOpen((isOpen) => !isOpen)}
            className="min-h-11 min-w-11 px-0 shadow-none hover:bg-transparent"
            variant="ghost"
            type="button"
            aria-expanded={open}
            aria-label={t("reports.filters.title")}
          >
            {open ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
            )}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <ReportFilterFieldsPanel
              category={category}
              allowed={allowed}
              filters={filters}
              onFieldChange={set}
              sessions={sessions}
              classes={classes}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
