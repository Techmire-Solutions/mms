import type { Student } from "@mms/shared";
import type { useMessageComposerState } from "@/hooks/useMessageComposerState";
import type {
  StudentsDeleteTarget,
  useStudentsPageOverlayState,
} from "@/tenant/features/students/hooks/useStudentsPageOverlayState";

export type StudentsPageOverlaysProps = {
  showStudentForm: boolean;
  editStudent: Student | null;
  onCloseForm: () => void;
  onSave: (student: Student) => void | Promise<void>;
  viewStudent: Student | null;
  onCloseView: () => void;
  onEditFromDrawer: (student: Student) => void;
  onRestoreFromDrawer?: (studentId: string) => void | Promise<void>;
  messagingTarget: ReturnType<typeof useMessageComposerState>["messagingTarget"];
  onCloseComposer: () => void;
  openComposer: ReturnType<typeof useMessageComposerState>["openComposer"];
  canWriteMessaging: boolean;
  canWrite: boolean;
  canDelete: boolean;
  bulkDeleteOpen: boolean;
  onBulkDeleteOpenChange: (open: boolean) => void;
  selectedCount: number;
  onConfirmBulkDelete: (reason?: string) => void | Promise<void>;
  deleteTarget: StudentsDeleteTarget | null;
  onDeleteTargetOpenChange: (open: boolean) => void;
  onConfirmSingleDelete: (reason?: string) => void | Promise<void>;
  bulkRestoreOpen: boolean;
  onBulkRestoreOpenChange: (open: boolean) => void;
  onConfirmBulkRestore: () => void | Promise<void>;
  idCardStudents: Student[];
  onCloseIdCards: () => void;
  onPrintIdCard?: (student: Student) => void;
  onViewStudent?: (student: Student) => void;
  onViewContact?: (contactId: string | number) => void;
  importOpen?: boolean;
  onCloseImport?: () => void;
};

/** Work-tier interaction slice of page-owned overlays (list + bulk bar). */
export type StudentsWorkOverlayInteractions = Pick<
  ReturnType<typeof useStudentsPageOverlayState>,
  | "statusBadgeConfig"
  | "openComposer"
  | "openSelectionMessage"
  | "canWriteMessaging"
  | "setConfirmBulkDeleteOpen"
  | "setConfirmBulkRestoreOpen"
  | "setDeleteTarget"
  | "setViewStudent"
  | "openIdCards"
>;
