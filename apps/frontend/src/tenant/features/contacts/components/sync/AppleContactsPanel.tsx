import React from "react";
import { Smartphone } from "lucide-react";
import { type Contact } from "@mms/shared";
import { DashedFileDropZone } from "@/components/ui/DashedFileDropZone";
import { SectionCard } from "@/components/ui/SectionCard";
import { useTranslation } from "@/hooks/useTranslation";
import { useAppleContactsPanel } from "@/tenant/features/contacts/hooks/useAppleContactsPanel";
import {
  AppleContactsExportBar,
  AppleContactsExportGuide,
  AppleContactsFileInput,
  AppleContactsImportResult,
  AppleContactsPreviewList,
} from "@/tenant/features/contacts/components/sync/AppleContactsPanelSections";

export interface AppleContactsPanelProps {
  onImport: (contacts: Contact[]) => void | Promise<void>;
  canWrite?: boolean;
}

/**
 * AppleContactsPanel component to import and export vCard files.
 */
export function AppleContactsPanel({
  onImport,
  canWrite = false,
}: AppleContactsPanelProps): React.JSX.Element {
  const { t } = useTranslation();
  const apple = useAppleContactsPanel({ onImport, canWrite });

  return (
    <SectionCard
      title={t("contacts.sync.appleTitle")}
      subtitle={t("contacts.sync.vcardLabel")}
      icon={Smartphone}
    >
      <div className="space-y-4 text-start">
        <AppleContactsExportGuide t={t} />

        {canWrite && (
          <AppleContactsFileInput fileRef={apple.fileRef} onChange={apple.handleFile} t={t} />
        )}

        {canWrite && apple.previewList.length === 0 && !apple.result && (
          <DashedFileDropZone
            isDragging={apple.isDragging}
            onOpenPicker={apple.openFilePicker}
            onDraggingChange={(dragging) => {
              if (canWrite) apple.setIsDragging(dragging);
            }}
            onFiles={apple.handleDroppedFiles}
            title={t("contacts.sync.uploadVcf")}
            description={t("contacts.sync.dragDropBrowse")}
            inputAriaLabel={t("contacts.sync.uploadVcf")}
            className="bg-card"
          />
        )}

        {apple.fileError && (
          <p
            role="alert"
            className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-2.5"
          >
            {apple.fileError}
          </p>
        )}

        {canWrite && apple.previewList.length > 0 && (
          <AppleContactsPreviewList
            previewList={apple.previewList}
            fileName={apple.fileName}
            importing={apple.importing}
            onClear={apple.clearPreview}
            onImport={() => void apple.handleImport()}
            onChooseDifferent={apple.chooseDifferentFile}
            t={t}
          />
        )}

        {apple.result && <AppleContactsImportResult result={apple.result} t={t} />}

        <AppleContactsExportBar
          contactCount={apple.exportCount}
          exporting={apple.exporting}
          onExport={() => void apple.handleExport()}
          t={t}
        />
      </div>
    </SectionCard>
  );
}
