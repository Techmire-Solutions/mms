import { useState } from "react";
import { toMessagingRecipient, type Faculty } from "@mms/shared";
import { useMessageComposerState } from "@/hooks/useMessageComposerState";
import type { FacultyIoEntity } from "@/tenant/features/faculty/facultyPageWorkSubTabs";

type MessageChannel = "whatsapp" | "sms" | "email";

export type FacultyDeleteTarget = { id: string; name?: string };

/** Page-owned Work overlays: composer, soft-delete confirms, profile drawer target. */
export function useFacultyPageOverlayState() {
  const { messagingTarget, openComposer, closeComposer, canWriteMessaging } =
    useMessageComposerState();
  const [confirmBulkDeleteOpen, setConfirmBulkDeleteOpen] = useState(false);
  const [confirmBulkRestoreOpen, setConfirmBulkRestoreOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FacultyDeleteTarget | null>(null);
  const [viewFaculty, setViewFaculty] = useState<Faculty | null>(null);
  const [idCardFaculty, setIdCardFaculty] = useState<Faculty[]>([]);
  const [createDepartmentOpen, setCreateDepartmentOpen] = useState(false);
  const [createDesignationOpen, setCreateDesignationOpen] = useState(false);
  const [importEntity, setImportEntity] = useState<FacultyIoEntity | null>(null);

  const openSelectionMessage = (channel: MessageChannel, targets: Faculty[]) => {
    openComposer(
      channel,
      targets.map((member) => toMessagingRecipient(member)),
    );
  };

  const openIdCardsModal = (facultyMembers: Faculty[]) => {
    setIdCardFaculty(facultyMembers);
  };

  const closeIdCardsModal = () => {
    setIdCardFaculty([]);
  };

  return {
    messagingTarget,
    openComposer,
    openSelectionMessage,
    closeComposer,
    canWriteMessaging,
    confirmBulkDeleteOpen,
    setConfirmBulkDeleteOpen,
    confirmBulkRestoreOpen,
    setConfirmBulkRestoreOpen,
    deleteTarget,
    setDeleteTarget,
    viewFaculty,
    setViewFaculty,
    idCardFaculty,
    setIdCardFaculty,
    openIdCardsModal,
    closeIdCardsModal,
    createDepartmentOpen,
    setCreateDepartmentOpen,
    createDesignationOpen,
    setCreateDesignationOpen,
    importEntity,
    setImportEntity,
  };
}
