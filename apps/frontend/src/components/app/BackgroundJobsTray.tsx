import React, { useState } from "react";
import { Download, Loader2, CheckCircle2, AlertCircle, RefreshCw, X } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { FormModal } from "@/components/app/FormModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type AppTranslationKey, type BackgroundJobRecord, formatDateTime } from "@mms/shared";

export interface BackgroundJobsTrayProps {
  compact?: boolean;
  className?: string;
  jobs?: BackgroundJobRecord[];
  activeJobs?: BackgroundJobRecord[];
  onDismiss?: (id: string) => void;
  onClearFinished?: () => void;
  onRefresh?: () => void;
  onDownload?: (jobId: string) => Promise<void>;
}

type ModuleLabelKey =
  | "backgroundJobs.module.contacts"
  | "backgroundJobs.module.students"
  | "backgroundJobs.module.accounting"
  | "backgroundJobs.module.obligations";

function moduleLabel(moduleId: string, t: (key: AppTranslationKey) => string): string {
  const keyMap: Record<string, ModuleLabelKey> = {
    contacts: "backgroundJobs.module.contacts",
    students: "backgroundJobs.module.students",
    accounting: "backgroundJobs.module.accounting",
    obligations: "backgroundJobs.module.obligations",
  };
  const key = keyMap[moduleId];
  return key ? t(key) : moduleId;
}

const EMPTY_JOBS: BackgroundJobRecord[] = [];

/** Global download / background job centre (globle1 §8). */
export function BackgroundJobsTray({
  compact: _compact = false,
  className,
  jobs = EMPTY_JOBS,
  activeJobs = EMPTY_JOBS,
  onDismiss,
  onClearFinished,
  onRefresh,
  onDownload,
}: BackgroundJobsTrayProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  if (jobs.length === 0) return null;

  const badgeCount = activeJobs.length || jobs.filter((j) => j.status === "failed").length;

  const handleDownload = async (jobId: string) => {
    if (!onDownload) return;
    setDownloadingId(jobId);
    try {
      await onDownload(jobId);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t("backgroundJobs.trayLabel")}
        onClick={() => setOpen(true)}
        className={cn("relative min-h-11 min-w-11 h-11 w-11 rounded-lg cursor-pointer", className)}
      >
        <Download className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        {badgeCount > 0 && (
          <Badge
            variant="secondary"
            className="absolute -top-0.5 -end-0.5 h-4 min-w-4 px-1 text-xs flex items-center justify-center"
          >
            {badgeCount}
          </Badge>
        )}
      </Button>

      {open && (
        <FormModal
          open={open}
          onClose={() => setOpen(false)}
          title={t("backgroundJobs.panelTitle")}
          size="sm"
          cancelLabel={t("common.close")}
          saveLabel={t("common.close")}
          onSave={() => setOpen(false)}
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="min-w-0 flex-1 text-sm text-muted-foreground">
                {t("backgroundJobs.panelDesc")}
              </p>
              {onRefresh && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onRefresh}
                  className="min-h-11 shrink-0 inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium shadow-none cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("backgroundJobs.refresh")}
                </Button>
              )}
            </div>
            <ul className="space-y-2 max-h-80 overflow-y-auto">
              {jobs.map((job) => {
                const pct =
                  job.progress && job.progress.total > 0
                    ? Math.round((job.progress.current / job.progress.total) * 100)
                    : null;
                return (
                  <li
                    key={job.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-border px-3 py-2.5 text-sm"
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      {job.status === "running" ? (
                        <Loader2 className="w-4 h-4 shrink-0 animate-spin motion-reduce:animate-none mt-0.5 text-info" aria-hidden="true" />
                      ) : job.status === "failed" ? (
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-destructive" aria-hidden="true" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-primary" aria-hidden="true" />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium truncate">{job.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {moduleLabel(job.moduleId, t)}
                          {" · "}
                          {formatDateTime(job.createdAt)}
                          {pct != null ? ` · ${pct}%` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {job.status === "completed" && job.hasDownload && onDownload && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => void handleDownload(job.id)}
                          disabled={downloadingId === job.id}
                          className="text-primary shadow-none cursor-pointer disabled:cursor-not-allowed min-h-11 min-w-11"
                          aria-label={t("backgroundJobs.download")}
                        >
                          {downloadingId === job.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                          ) : (
                            <Download className="w-3.5 h-3.5" aria-hidden="true" />
                          )}
                        </Button>
                      )}
                      {job.status !== "running" && onDismiss && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => onDismiss(job.id)}
                          className="shadow-none cursor-pointer min-h-11 min-w-11"
                          aria-label={t("backgroundJobs.dismiss")}
                        >
                          <X className="w-3.5 h-3.5" aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            {jobs.some((j) => j.status !== "running") && onClearFinished && (
              <Button
                type="button"
                variant="link"
                onClick={onClearFinished}
                className="min-h-11 px-2 text-xs text-muted-foreground cursor-pointer"
              >
                {t("backgroundJobs.clearFinished")}
              </Button>
            )}
          </div>
        </FormModal>
      )}
    </>
  );
}
