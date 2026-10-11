import React from "react";
import { Upload } from "lucide-react";
import type { Contact } from "@mms/shared";
import { DashedFileDropZone } from "@/components/ui/DashedFileDropZone";
import { Modal } from "@/components/ui/Modal";
import { useTranslation } from "@/hooks/useTranslation";
import { useAppleContactsPanel } from "@/tenant/features/contacts/hooks/useAppleContactsPanel";
import {
  AppleContactsFileInput,
  AppleContactsImportResult,
  AppleContactsPreviewList,
} from "@/tenant/features/contacts/components/sync/AppleContactsPanelSections";

export interface ContactsImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (contacts: Contact[]) => void | Promise<void>;
  /** Import writes contacts — the CTA is hidden without `contacts.write`. */
  canWrite: boolean;
}

/**
 * Contacts vCard (.vcf) import, reachable from the Work header.
 *
 * Composes the same import machinery as the Contacts Setup → Sync panel so a Work-tier
 * user with `contacts.write` (but no `configuration.view`) can import without leaving Work.
 */
export function ContactsImportDialog({
  open,
  onClose,
  onImport,
  canWrite,
}: ContactsImportDialogProps): React.JSX.Element | null {
  // Unmount the body while closed so each open starts from a clean preview/result state.
  if (!open || !canWrite) return null;
  return <ContactsImportDialogBody onClose={onClose} onImport={onImport} canWrite={canWrite} />;
}

function ContactsImportDialogBody({
  onClose,
  onImport,
  canWrite,
}: Omit<ContactsImportDialogProps, "open">): React.JSX.Element {
  const { t } = useTranslation();
  const apple = useAppleContactsPanel({ onImport, canWrite });
  // The drop zone stays available after a run so a second file needs no close/reopen.
  const showDropZone = apple.previewList.length === 0;

  return (
    <Modal
      open
      onClose={onClose}
      icon={Upload}
      title={t("contacts.import")}
      subtitle={t("contacts.sync.vcardLabel")}
      size="md"
    >
      <div className="space-y-4 text-start">
        <AppleContactsFileInput
          fileRef={apple.fileRef}
          onChange={apple.handleFile}
          t={t}
          inputId="contacts-vcf-import-dialog-file-input"
        />

        {apple.result && <AppleContactsImportResult result={apple.result} t={t} />}

        {apple.fileError && (
          <p
            role="alert"
            className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-2.5"
          >
            {apple.fileError}
          </p>
        )}

        {showDropZone && (
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

        {apple.previewList.length > 0 && (
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

        {apple.importing && apple.importProgress && apple.importProgress.total > 0 && (
          <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
            {t("contacts.importProgress", {
              imported: apple.importProgress.imported,
              total: apple.importProgress.total,
            })}
          </p>
        )}
      </div>
    </Modal>
  );
}
