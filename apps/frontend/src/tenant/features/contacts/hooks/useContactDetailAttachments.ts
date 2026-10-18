import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { AppTranslationKey, Contact } from "@mms/shared";
import { todayISO } from "@mms/shared";
import { uploadAttachmentFile } from "@/lib/attachmentUpload";
import { notify } from "@/lib/notify";
import { useTranslation } from "@/hooks/useTranslation";

export function useContactDetailAttachments({
  contactState,
  setContactState,
  canPersistContact,
  onUpdateContact,
}: {
  contactState: Contact;
  setContactState: Dispatch<SetStateAction<Contact>>;
  canPersistContact: boolean;
  onUpdateContact?: (contact: Contact) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingAttachmentDelete, setPendingAttachmentDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateContactAttachments = useCallback(
    async (
      newAttachments: NonNullable<Contact["attachments"]>,
      successMessageKey: AppTranslationKey,
      failureMessageKey: AppTranslationKey,
      optimistic = true,
    ): Promise<boolean> => {
      if (!canPersistContact || !onUpdateContact) return false;
      const updatedContact: Contact = { ...contactState, attachments: newAttachments };
      const previousState = contactState;
      if (optimistic) setContactState(updatedContact);
      try {
        await onUpdateContact(updatedContact);
        if (!optimistic) setContactState(updatedContact);
        notify.success(t(successMessageKey));
        return true;
      } catch {
        if (optimistic) setContactState(previousState);
        notify.error(t(failureMessageKey));
        return false;
      }
    },
    [canPersistContact, contactState, onUpdateContact, setContactState, t],
  );

  const handleFiles = useCallback(
    async (filesList: FileList | null) => {
      if (!canPersistContact || !filesList || filesList.length === 0) return;
      setIsUploading(true);
      try {
        const files = Array.from(filesList);
        const results = await Promise.all(files.map((file) => uploadAttachmentFile(file)));
        const newAttachments = [
          ...(contactState.attachments || []),
          ...results.map((res) => ({
            id: crypto.randomUUID(),
            name: res.name,
            type: res.type,
            size: res.size,
            url: res.url,
            date: todayISO(),
          })),
        ];
        await updateContactAttachments(
          newAttachments,
          "contacts.detail.uploadSuccess",
          "contacts.detail.uploadFailed",
        );
      } catch {
        notify.error(t("contacts.detail.uploadFailed"));
      } finally {
        setIsUploading(false);
      }
    },
    [canPersistContact, contactState.attachments, t, updateContactAttachments],
  );

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    void handleFiles(e.target.files);
  };

  const confirmAttachmentDelete = async (): Promise<void> => {
    if (!pendingAttachmentDelete || !canPersistContact) return;
    const remainingAttachments = (contactState.attachments || []).filter(
      (attachment) => attachment.id !== pendingAttachmentDelete.id,
    );
    const removed = await updateContactAttachments(
      remainingAttachments,
      "contacts.detail.deleteSuccess",
      "contacts.saveFailed",
      false,
    );
    if (removed) setPendingAttachmentDelete(null);
  };

  return {
    isDragging,
    setIsDragging,
    isUploading,
    pendingAttachmentDelete,
    setPendingAttachmentDelete,
    fileInputRef,
    handleFiles,
    handleFileChange,
    confirmAttachmentDelete,
  };
}
