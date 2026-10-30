import React from "react";
import { CheckCircle2 } from "lucide-react";
import { formatBackupSize, type WorkspaceBackupSummary } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { Badge } from "@/components/ui/badge";

interface BackupSummaryPreviewProps {
  summary: WorkspaceBackupSummary;
  targetSubdomain: string;
  exportedLabel: string | null;
}

export function BackupSummaryPreview({
  summary,
  targetSubdomain,
  exportedLabel,
}: BackupSummaryPreviewProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 space-y-3">
      <p className="text-sm font-semibold text-foreground">{t("backup.previewTitle")}</p>
      <div className="flex flex-wrap gap-2">
        <Badge as="span" tone="primary" size="sm">
          {t("backup.previewKeys", { count: summary.keyCount })}
        </Badge>
        <Badge as="span" tone="muted" size="sm">
          {t("backup.previewCollections", { count: summary.collectionCount })}
        </Badge>
        <Badge as="span" tone="muted" size="sm">
          {t("backup.previewObjects", { count: summary.objectCount })}
        </Badge>
      </div>
      {summary.checksum ? (
        <p className="flex items-center gap-1.5 text-xs text-success font-medium">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {t("backup.integrityVerified")}
        </p>
      ) : null}
      {summary.entityBreakdown && Object.keys(summary.entityBreakdown).length > 0 ? (
        <div className="space-y-1.5 pt-1 border-t border-border/40">
          <p className="text-xs font-medium text-foreground">{t("backup.entityBreakdownTitle")}</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(summary.entityBreakdown)
              .filter(([, count]) => count > 0)
              .slice(0, 10)
              .map(([name, count]) => (
                <Badge
                  key={name}
                  variant="outline"
                  className="text-3xs font-medium bg-background border-border text-foreground/90 capitalize"
                >
                  {name.replace(/_/g, " ")}: {count}
                </Badge>
              ))}
          </div>
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">
        {t("backup.previewSize", { size: formatBackupSize(summary.byteSize) })}
      </p>
      {exportedLabel ? (
        <p className="text-xs text-muted-foreground">
          {t("backup.previewExportedAt", { date: exportedLabel })}
        </p>
      ) : null}
      {summary.subdomain ? (
        <p className="text-xs text-muted-foreground">
          {t("backup.previewWorkspace", { workspace: summary.subdomain })}
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        {t("backup.previewRestoreTarget", { workspace: targetSubdomain })}
      </p>
      {summary.legacyFormat ? (
        <p className="text-xs text-warning">{t("backup.previewLegacyFormat")}</p>
      ) : null}
      {summary.dataSource === "server" ? (
        <p className="text-xs text-primary">{t("backup.previewServerSource")}</p>
      ) : summary.dataSource === "local" ? (
        <p className="text-xs text-warning">{t("backup.previewLocalSource")}</p>
      ) : null}
    </div>
  );
}
