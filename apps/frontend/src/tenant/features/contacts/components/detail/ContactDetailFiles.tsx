import type React from "react";
import type { ChangeEvent, RefObject } from "react";
import { ExternalLink, FileText, Trash2 } from "lucide-react";
import { formatDate, type Contact } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DashedFileDropZone } from "@/components/app/DashedFileDropZone";
import {
  MESSAGING_ICON_BTN,
  MESSAGING_ICON_BTN_TONES,
} from "@/components/app/messagingActionStyles";
import { cn } from "@/lib/utils";
import { DetailCollectionEmpty } from "./contactDetailChannelHelpers";

export interface ContactDetailFilesProps {
  contact: Contact;
  canPersistContact: boolean;
  isDragging: boolean;
  isUploading: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onDraggingChange: (dragging: boolean) => void;
  onFiles: (filesList: FileList | null) => void;
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onRequestDelete: (attachment: { id: string; name: string }) => void;
}

export function ContactDetailFiles({
  contact,
  canPersistContact,
  isDragging,
  isUploading,
  fileInputRef,
  onDraggingChange,
  onFiles,
  onFileChange,
  onRequestDelete,
}: ContactDetailFilesProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      {canPersistContact && (
        <DashedFileDropZone
          isDragging={isDragging}
          onDraggingChange={onDraggingChange}
          onFiles={onFiles}
          onFileChange={onFileChange}
          fileInputRef={fileInputRef}
          isUploading={isUploading}
          multiple
          title={
            isUploading
              ? t("contacts.detail.uploading")
              : t("contacts.detail.cloudStorageRepository")
          }
          description={t("contacts.detail.dragDropDocuments")}
          inputAriaLabel={t("contacts.detail.cloudStorageRepository")}
          inputId="contact-drawer-document-upload-input"
          inputName="contactDocumentUpload"
          browseLabel={t("contacts.detail.browseFiles")}
        />
      )}

      <div className="space-y-3">
        {!contact.attachments || contact.attachments.length === 0 ? (
          <DetailCollectionEmpty title={t("contacts.detail.repositoryEmpty")} />
        ) : (
          <Card className="divide-y divide-border/50 p-0">
            {contact.attachments.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-muted text-muted-foreground">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h5 className="text-xs font-bold text-foreground truncate">{file.name}</h5>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Intl.NumberFormat(undefined, {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      }).format(file.size / 1024)}{" "}
                      {t("contacts.detail.kbLabel")} · {formatDate(file.date)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <a
                    href={file.url}
                    download={file.name}
                    aria-label={t("contacts.detail.downloadFile", { name: file.name })}
                    className={cn(
                      MESSAGING_ICON_BTN,
                      MESSAGING_ICON_BTN_TONES.link,
                      "flex items-center justify-center",
                    )}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  {canPersistContact && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t("contacts.detail.deleteFile", { name: file.name })}
                      onClick={() => onRequestDelete({ id: file.id, name: file.name })}
                      className="min-h-11 min-w-11 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shadow-none"
                      type="button"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
