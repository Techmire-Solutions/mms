import React from "react";
import { AlertTriangle, Bookmark, Clock, Play, Trash2, User, Users } from "lucide-react";
import type {
  ContactsSavedReport,
  ContactsSavedReportShareScope,
  ContactsWorkDrillDown,
} from "@mms/shared";
import { canDeleteContactsSavedReport, validateContactsSavedReportDrillDown } from "@mms/shared";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WORK_SURFACE } from "@/components/ui/formStyles";
import { useTranslation } from "@/hooks/useTranslation";

function formatDrillDownSummary(drillDown: ContactsWorkDrillDown, searchLabel: string): string {
  const parts: string[] = [];
  if (drillDown.gender) parts.push(drillDown.gender);
  if (drillDown.search?.trim()) parts.push(`${searchLabel}: ${drillDown.search.trim()}`);
  return parts.join(" · ") || "—";
}

interface ContactsSavedReportsListProps {
  reports: ContactsSavedReport[];
  isLoading: boolean;
  isError: boolean;
  genders: string[];
  searchLabel: string;
  userId: string | null;
  role: string | null | undefined;
  isAdmin: boolean;
  shareLabel: (scope: ContactsSavedReportShareScope | undefined) => string;
  formatLastRun: (iso?: string) => string;
  onRetry: () => void;
  onRun: (report: ContactsSavedReport) => void;
  onDelete: (id: string) => void;
}

export function ContactsSavedReportsList({
  reports,
  isLoading,
  isError,
  genders,
  searchLabel,
  userId,
  role,
  isAdmin,
  shareLabel,
  formatLastRun,
  onRetry,
  onRun,
  onDelete,
}: ContactsSavedReportsListProps): React.JSX.Element {
  const { t } = useTranslation();

  if (isError) {
    return (
      <ErrorState
        title={t("errors.state.generic")}
        description={t("common.retry")}
        onRetry={onRetry}
        compact
      />
    );
  }

  if (isLoading) {
    return <p className="text-xs text-muted-foreground">{t("common.loading")}</p>;
  }

  if (reports.length === 0) {
    return (
      <EmptyState
        icon={Bookmark}
        title={t("contacts.savedReports.emptyTitle")}
        description={t("contacts.savedReports.emptyDescription")}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {reports.map((savedReport) => {
        const issues = validateContactsSavedReportDrillDown(savedReport.drillDown, { genders });
        const canDelete = Boolean(
          userId &&
          canDeleteContactsSavedReport(savedReport, {
            id: userId,
            role: role ?? "",
            isAdmin,
          }),
        );

        return (
          <div
            key={savedReport.id}
            className={`${WORK_SURFACE} p-5 flex flex-col gap-3 text-start`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-foreground">{savedReport.name}</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDrillDownSummary(savedReport.drillDown, searchLabel)}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <Badge pill tone="primary" className="gap-1 uppercase tracking-wide px-2">
                    <Users className="w-3 h-3" />
                    {shareLabel(savedReport.shareScope)}
                  </Badge>
                  {issues.length > 0 && (
                    <Badge pill tone="warning" className="gap-1 px-2 bg-warning/15">
                      <AlertTriangle className="w-3 h-3" />
                      {t("contacts.savedReports.staleBadge")}
                    </Badge>
                  )}
                </div>
              </div>
              <Bookmark className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatLastRun(savedReport.lastRunAt)}
              </span>
              {(savedReport.createdByName || savedReport.createdBy) && (
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {savedReport.createdByName || savedReport.createdBy}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-border">
              <Button
                type="button"
                variant="link"
                onClick={() => onRun(savedReport)}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline min-h-11 px-2 shadow-none"
              >
                <Play className="w-3 h-3" />
                {t("contacts.savedReports.run")}
              </Button>
              {canDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onDelete(savedReport.id)}
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-destructive transition-colors ms-auto min-h-11 px-2 hover:bg-transparent shadow-none"
                >
                  <Trash2 className="w-3 h-3" />
                  {t("contacts.savedReports.delete")}
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
