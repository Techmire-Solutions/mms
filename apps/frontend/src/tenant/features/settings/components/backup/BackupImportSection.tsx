import React from "react";
import { AlertTriangle, Upload, FileJson } from "lucide-react";
import { SectionCard } from "@/components/app/SectionCard";
import { SettingsCallout } from "@/components/app/SettingsShell";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

interface BackupImportSectionProps {
  dragActive: boolean;
  selectedFileName: string | null;
  uploadLimitLabel: string;
  onDragActiveChange: (active: boolean) => void;
  onFileSelected: (file: File | undefined) => void;
}

const BackupImportSection = function BackupImportSection({
  dragActive,
  selectedFileName,
  uploadLimitLabel,
  onDragActiveChange,
  onFileSelected,
}: BackupImportSectionProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <SectionCard
      title={t("backup.restoreFileTitle")}
      subtitle={t("backup.restoreFileDesc")}
      icon={Upload}
    >
      <label
        htmlFor="workspace-backup"
        tabIndex={0}
        role="button"
        aria-label={t("backup.restoreFileTitle")}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            document.getElementById("workspace-backup")?.click();
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          onDragActiveChange(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          onDragActiveChange(false);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          onDragActiveChange(false);
          onFileSelected(event.dataTransfer?.files?.[0]);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed py-8 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          dragActive
            ? "border-primary bg-primary/5 shadow-inner"
            : "border-border bg-card/60 hover:border-primary/50 hover:bg-muted/30 shadow-sm",
        )}
      >
        <div
          className={cn(
            "mb-3 p-3 rounded-full transition-colors duration-200",
            dragActive ? "bg-primary/10" : "bg-muted group-hover:bg-primary/10",
          )}
        >
          <Upload
            className={cn(
              "h-5 w-5 transition-transform duration-200 group-hover:-translate-y-0.5",
              dragActive ? "text-primary" : "text-muted-foreground group-hover:text-primary",
            )}
            aria-hidden
          />
        </div>

        <span className="text-sm font-semibold text-foreground text-center px-4">
          {dragActive ? t("backup.dropzoneActive") : t("backup.dropzone")}
        </span>
        <span className="mt-1 text-xs text-muted-foreground text-center px-4">
          {t("backup.dropzoneHint")}
        </span>
        <span className="mt-1.5 text-3xs font-medium text-muted-foreground bg-muted/60 border border-border/50 px-2 py-0.5 rounded">
          {t("backup.uploadLimitHint", { limit: uploadLimitLabel })}
        </span>

        {selectedFileName ? (
          <div className="mt-3 mx-4 flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/20 px-3 py-1.5 animate-in fade-in zoom-in duration-200">
            <FileJson className="h-4 w-4 text-primary shrink-0 animate-pulse" />
            <span className="text-xs font-semibold text-primary truncate max-w-cell-trunc">
              {t("backup.fileSelected", { name: selectedFileName })}
            </span>
          </div>
        ) : null}

        <input
          id="workspace-backup"
          type="file"
          accept=".mmsbak"
          name="workspace-backup"
          className="hidden"
          onChange={(event) => {
            onFileSelected(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </label>

      <div className="mt-4">
        <SettingsCallout variant="warning">
          <span className="flex items-start gap-2.5 text-xs font-medium leading-relaxed">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
            <span>{t("backup.restoreWarning")}</span>
          </span>
        </SettingsCallout>
      </div>
    </SectionCard>
  );
};

export default BackupImportSection;
