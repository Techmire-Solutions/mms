import React, { useState } from "react";
import { Download, FileSpreadsheet, Upload, AlertCircle, CheckCircle2 } from "lucide-react";
import type { BackgroundJobRecord } from "@mms/shared";
import { DashedFileDropZone } from "@/components/ui/DashedFileDropZone";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/button";

export interface ModuleImportDialogProps<TRow = Record<string, unknown>> {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  canWrite: boolean;
  actions: {
    fileName: string;
    parsedRows: TRow[];
    missingHeaders: string[];
    rowErrors: Array<{ row: number; error: string }>;
    isImporting: boolean;
    progress: { current: number; total: number } | null;
    completedJob: BackgroundJobRecord | null;
    handleFileSelect: (file: File) => void | Promise<void>;
    handleDownloadTemplate: () => void;
    handleStartImport: () => void | Promise<void>;
    resetState: () => void;
  };
}

export function ModuleImportDialog<TRow = Record<string, unknown>>({
  open,
  onClose,
  title,
  subtitle,
  canWrite,
  actions,
}: ModuleImportDialogProps<TRow>): React.JSX.Element | null {
  const [isDragging, setIsDragging] = useState(false);

  if (!open || !canWrite) return null;

  const {
    fileName,
    parsedRows,
    missingHeaders,
    rowErrors,
    isImporting,
    progress,
    completedJob,
    handleFileSelect,
    handleDownloadTemplate,
    handleStartImport,
    resetState,
  } = actions;

  const onFiles = (files: FileList | null) => {
    if (files && files.length > 0) {
      void handleFileSelect(files[0]);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      icon={Upload}
      title={title}
      subtitle={subtitle ?? "Upload CSV file to import records"}
      size="md"
    >
      <div className="space-y-4 text-start">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <span className="text-xs text-muted-foreground">Download standard template:</span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadTemplate}
            className="gap-1.5 text-xs h-8"
          >
            <Download className="w-3.5 h-3.5" />
            Download CSV Template
          </Button>
        </div>

        {missingHeaders.length > 0 && (
          <div
            role="alert"
            className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive space-y-1"
          >
            <div className="font-semibold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" />
              Missing required columns
            </div>
            <p>{missingHeaders.join(", ")}</p>
          </div>
        )}

        {rowErrors.length > 0 && (
          <div
            role="alert"
            className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-700 dark:text-amber-400 max-h-32 overflow-y-auto space-y-1"
          >
            <div className="font-semibold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" />
              Formatting warnings ({rowErrors.length})
            </div>
            {rowErrors.slice(0, 5).map((err, idx) => (
              <p key={idx}>
                Row {err.row}: {err.error}
              </p>
            ))}
            {rowErrors.length > 5 && <p>...and {rowErrors.length - 5} more issues.</p>}
          </div>
        )}

        {completedJob ? (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-700 dark:text-emerald-400 space-y-2 text-center">
            <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-600 dark:text-emerald-400" />
            <div className="font-semibold text-sm">{completedJob.label}</div>
            <Button variant="outline" size="sm" onClick={resetState}>
              Import Another File
            </Button>
          </div>
        ) : parsedRows.length > 0 ? (
          <div className="p-4 bg-card border border-border rounded-lg space-y-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium">{fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {parsedRows.length} valid record(s) ready to import
                </p>
              </div>
            </div>

            {isImporting ? (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Importing...</span>
                  {progress && (
                    <span>
                      {progress.current} / {progress.total}
                    </span>
                  )}
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-primary h-2 transition-all duration-300"
                    style={{
                      width:
                        progress && progress.total > 0
                          ? `${Math.min(100, Math.round((progress.current / progress.total) * 100))}%`
                          : "100%",
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={resetState}>
                  Change File
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => void handleStartImport()}
                  disabled={missingHeaders.length > 0}
                  className="gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Import {parsedRows.length} Records
                </Button>
              </div>
            )}
          </div>
        ) : (
          <DashedFileDropZone
            isDragging={isDragging}
            onDraggingChange={setIsDragging}
            onFiles={onFiles}
            title="Drop CSV file here"
            description="or click to browse from your device (.csv format)"
            inputAriaLabel="Upload CSV file"
            inputId="module-csv-file-input"
            inputName="file"
            accept=".csv,text/csv"
            className="bg-card"
          />
        )}
      </div>
    </Modal>
  );
}
