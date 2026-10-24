import type { Faculty } from "@mms/shared";
import type { useMessageComposerState } from "@/hooks/useMessageComposerState";
import type {
  FacultyDeleteTarget,
  useFacultyPageOverlayState,
} from "@/tenant/features/faculty/hooks/useFacultyPageOverlayState";

export type FacultyPageOverlaysProps = {
  showForm: boolean;
  editFaculty?: Faculty | null;
  onCloseForm: () => void;
  onSave: (faculty: Faculty) => void | Promise<void>;
  viewFaculty?: Faculty | null;
  onCloseView: () => void;
  onEditFromDrawer: (faculty: Faculty) => void;
  onRestoreFromDrawer?: (facultyId: string) => void | Promise<void>;
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
  deleteTarget: FacultyDeleteTarget | null;
  onDeleteTargetOpenChange: (open: boolean) => void;
  onConfirmSingleDelete: (reason?: string) => void | Promise<void>;
  bulkRestoreOpen: boolean;
  onBulkRestoreOpenChange: (open: boolean) => void;
  onConfirmBulkRestore: () => void | Promise<void>;
  idCardFaculty?: Faculty[];
  onCloseIdCards?: () => void;
  onPrintIdCard?: (faculty: Faculty) => void;
  onFilterSubordinates?: (facultyId: string) => void;
  createDepartmentOpen?: boolean;
  onCloseCreateDepartment?: () => void;
  createDesignationOpen?: boolean;
  onCloseCreateDesignation?: () => void;
  importEntity?: import("@/tenant/features/faculty/facultyPageWorkSubTabs").FacultyIoEntity | null;
  onCloseImport?: () => void;
};

/** Work-tier interaction slice of page-owned overlays (list + bulk bar). */
export type FacultyWorkOverlayInteractions = Pick<
  ReturnType<typeof useFacultyPageOverlayState>,
  | "openComposer"
  | "openSelectionMessage"
  | "canWriteMessaging"
  | "setConfirmBulkDeleteOpen"
  | "setConfirmBulkRestoreOpen"
  | "setDeleteTarget"
  | "setViewFaculty"
  | "idCardFaculty"
  | "openIdCardsModal"
  | "closeIdCardsModal"
>;
