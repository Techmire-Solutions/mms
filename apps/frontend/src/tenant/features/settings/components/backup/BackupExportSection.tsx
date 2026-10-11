import React from "react";
import {
  Database,
  Download,
  RefreshCw,
  Layers,
  Settings,
  HardDrive,
  CheckCircle2,
  Users,
  DollarSign,
  BookOpen,
} from "lucide-react";
import { SectionCard } from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { StatCard } from "@/components/ui/StatCard";
import type { WorkspaceExportStats } from "@/tenant/features/settings/hooks/backupRestoreTypes";

interface BackupExportSectionProps {
  adminEmail: string;
  isCreating: boolean;
  lastExportStats: WorkspaceExportStats | null;
  onStartExport: () => void;
}

const BackupExportSection = function BackupExportSection({
  adminEmail,
  isCreating,
  lastExportStats,
  onStartExport,
}: BackupExportSectionProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <SectionCard
      title={t("backup.createTitle")}
      subtitle={t("backup.createDesc")}
      icon={Database}
      className="flex flex-col justify-between"
    >
      <div className="space-y-5 pt-1 flex-1 flex flex-col justify-between">
        {/* Dynamic content area */}
        <div className="flex-1">
          {lastExportStats ? (
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-success">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{t("backup.createSuccess")}</span>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <StatCard
                  variant="compact"
                  icon={Layers}
                  label={t("backup.historyCollections")}
                  value={lastExportStats.collections}
                  accent="primary"
                />
                <StatCard
                  variant="compact"
                  icon={Settings}
                  label={t("backup.historyObjects")}
                  value={lastExportStats.objects}
                  accent="primary"
                />
                <StatCard
                  variant="compact"
                  icon={HardDrive}
                  label={t("backup.historySize")}
                  value={lastExportStats.size}
                  accent="primary"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3 py-1">
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t("backup.createDesc")}
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-card/40 px-3 py-2">
                  <Users className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="truncate">{t("backup.badgeStudentsAndTeachers")}</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-card/40 px-3 py-2">
                  <DollarSign className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="truncate">{t("backup.badgeFinanceAndFees")}</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-card/40 px-3 py-2">
                  <Database className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="truncate">{t("backup.badgeCrmContacts")}</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-card/40 px-3 py-2">
                  <BookOpen className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="truncate">{t("nav.questionBank")}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <Button
            type="button"
            variant="default"
            onClick={onStartExport}
            disabled={isCreating || !adminEmail}
            className="w-full sm:w-auto gap-2.5 min-h-11 px-6 shadow-md hover:shadow-lg interactive-scale rounded-xl relative overflow-hidden"
          >
            {isCreating ? (
              <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Download
                className="h-4 w-4 transition-transform duration-300 group-hover:translate-y-0.5"
                aria-hidden
              />
            )}
            <span className="font-semibold text-sm">
              {isCreating ? t("backup.creating") : t("backup.createButton")}
            </span>
          </Button>
        </div>
      </div>
    </SectionCard>
  );
};

export default BackupExportSection;
