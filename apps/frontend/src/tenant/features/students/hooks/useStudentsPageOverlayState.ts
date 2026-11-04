import { useCallback, useState } from "react";
import { toMessagingRecipient, type Student } from "@mms/shared";
import { useMessageComposerState } from "@/hooks/useMessageComposerState";
import { useTranslation } from "@/hooks/useTranslation";
import { studentStatusBadgeConfig } from "@/lib/students/studentStatusUi";

type MessageChannel = "whatsapp" | "sms" | "email";

export type StudentsDeleteTarget = { id: string; name?: string };

/** Page-owned Work overlays: composer, soft-delete confirms, profile drawer target. */
export function useStudentsPageOverlayState(options?: { statuses?: readonly string[] }) {
  const { t } = useTranslation();
  // The bulk-status menu reads its options from this config, so it must use the
  // tenant's configured statuses (S-02), not the global defaults.
  const statusBadgeConfig = studentStatusBadgeConfig(t, options?.statuses);
  const { messagingTarget, openComposer, closeComposer, canWriteMessaging } =
    useMessageComposerState();
  const [confirmBulkDeleteOpen, setConfirmBulkDeleteOpen] = useState(false);
  const [confirmBulkRestoreOpen, setConfirmBulkRestoreOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StudentsDeleteTarget | null>(null);
  const [viewStudent, setViewStudent] = useState<Student | null>(null);
  const [idCardStudents, setIdCardStudents] = useState<Student[]>([]);

  const openSelectionMessage = useCallback(
    (channel: MessageChannel, targets: Student[]) => {
      openComposer(
        channel,
        targets.map((student) => toMessagingRecipient(student)),
      );
    },
    [openComposer],
  );

  const openIdCards = useCallback((students: Student[]) => {
    setIdCardStudents(students);
  }, []);

  const closeIdCards = useCallback(() => {
    setIdCardStudents([]);
  }, []);

  return {
    statusBadgeConfig,
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
    viewStudent,
    setViewStudent,
    idCardStudents,
    openIdCards,
    closeIdCards,
  };
}
