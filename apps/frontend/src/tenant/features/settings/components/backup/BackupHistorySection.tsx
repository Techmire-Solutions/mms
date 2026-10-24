import React from "react";
import { CheckCircle2, Clock, HardDriveDownload, RefreshCw, AlertTriangle } from "lucide-react";
import { BACKUP_HISTORY_MAX, formatDateTime, type WorkspaceBackupRecord } from "@mms/shared";
import { SectionCard } from "@/components/app/SectionCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/app/EmptyState";

import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

interface BackupHistorySectionProps {
  backups: WorkspaceBackupRecord[];
  restoreId: string | null;
  onRestore: (backup: WorkspaceBackupRecord) => void;
  onDownload: (backup: WorkspaceBackupRecord) => void;
}

export default function BackupHistorySection({
  backups,
  restoreId,
  onRestore,
  onDownload,
}: BackupHistorySectionProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <SectionCard
      title={t("backup.historyTitle")}
      subtitle={t("backup.historyDesc")}
      icon={Clock}
      padding={false}
      className="overflow-hidden"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-5 py-3.5 bg-muted/20">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" aria-hidden />
          <span className="text-xs font-semibold text-foreground">{t("backup.historyTitle")}</span>
        </div>
        <Badge as="span" tone={backups.length > 0 ? "primary" : "muted"} size="sm">
          {t("backup.historyCount", { count: backups.length, max: BACKUP_HISTORY_MAX })}
        </Badge>
      </div>

      <div className="divide-y divide-border/40">
        {backups.length === 0 ? (
          <EmptyState icon={Clock} title={t("backup.historyEmpty")} compact />
        ) : (
          backups.map((backup) => {
            const isRestoringThis = restoreId === backup.id;
            return (
              <div
                key={backup.id}
                className="flex flex-wrap items-center gap-3 px-5 py-4 sm:gap-4 hover:bg-muted/30 transition-all duration-200 group/item"
              >
                <div
                  className={cn(
                    "p-2 rounded-lg transition-colors duration-200 shrink-0",
                    isRestoringThis ? "bg-primary/10 text-primary" : "bg-success/10 text-success",
                  )}
                >
                  {isRestoringThis ? (
                    <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-foreground truncate">{backup.name}</p>
                    <Badge
                      variant="outline"
                      className="font-mono text-3xs py-0 px-1.5 font-semibold text-muted-foreground"
                    >
                      {backup.size}
                    </Badge>
                  </div>

                  {backup.keyCount != null ? (
                    <p className="mt-1 text-xs text-muted-foreground leading-normal">
                      {t("backup.exportStats", {
                        collections: backup.collectionCount ?? 0,
                        objects: backup.objectCount ?? 0,
                        size: backup.size,
                      })}
                    </p>
                  ) : null}

                  {!backup.data ? (
                    <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-warning/90">
                      <AlertTriangle className="h-3 w-3 animate-pulse" aria-hidden />
                      <span>{t("backup.metadataOnly")}</span>
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-xs font-medium text-muted-foreground">
                    {formatDateTime(backup.date)}
                  </span>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onRestore(backup)}
                      disabled={restoreId !== null || !backup.data}
                      className={cn(
                        "min-h-11 px-3 font-semibold text-xs interactive-scale",
                        isRestoringThis && "border-primary/30 text-primary bg-primary/5",
                      )}
                    >
                      {isRestoringThis ? (
                        <>
                          <RefreshCw className="h-3 w-3 animate-spin me-1.5" aria-hidden />
                          {t("backup.restoring")}
                        </>
                      ) : (
                        t("backup.restore")
                      )}
                    </Button>

                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => onDownload(backup)}
                      aria-label={t("backup.download")}
                      disabled={restoreId !== null || !backup.data}
                      className="min-h-11 min-w-11 text-muted-foreground"
                    >
                      <HardDriveDownload
                        className="h-4 w-4 transition-transform duration-300 group-hover/item:translate-y-0.5"
                        aria-hidden
                      />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </SectionCard>
  );
}
