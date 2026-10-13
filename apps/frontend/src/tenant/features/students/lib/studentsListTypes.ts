import type { Student, StudentSortField } from "@mms/shared";
import { type toMessagingRecipient, type ModuleColumnRegistryEntry } from "@mms/shared";
import type { StatusBadgeConfigItem } from "@/components/ui/StatusBadge";
import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";

export type StudentsListContentSortField = StudentSortField;

interface StudentsListContentSession {
  id: string;
  name: string;
}

export type StudentsListContentMessagingRecipient = ReturnType<typeof toMessagingRecipient>;

interface StudentsListContentSelectionProps {
  selectedIds: string[];
  viewingDeleted: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canWriteMessaging?: boolean;
  statusBadgeConfig: Record<string, StatusBadgeConfigItem>;
  /** Work column prefs — call in leaves (no show* fans). */
  isColumnVisible: (key: string) => boolean;
  /** Tenant Work column registry (system + custom:*). */
  columnRegistry: ModuleColumnRegistryEntry[];
  onSelectOne: (id: string) => void;
  onViewStudent: (student: Student) => void;
  onEdit: (student: Student) => void;
  onDelete: (id: string, deletionReason?: string) => void | Promise<void>;
  onRestore?: (id: string) => void | Promise<void>;
}

export interface StudentsListCardsProps extends StudentsListContentSelectionProps {
  paginatedStudents: Student[];
  sessions: StudentsListContentSession[];
  allSelected: boolean;
  someSelected: boolean;
  onSelectAll: () => void;
  onOpenComposer?: (
    mode: "whatsapp" | "sms" | "email",
    recipients: StudentsListContentMessagingRecipient[],
  ) => void;
}

export interface StudentsListContentTableProps extends StudentsListContentSelectionProps {
  paginatedStudents: Student[];
  sessions: StudentsListContentSession[];
  allSelected: boolean;
  someSelected: boolean;
  sortField: StudentsListContentSortField | null;
  sortDir: "asc" | "desc";
  onSort: (field: StudentsListContentSortField) => void;
  onSelectAll: () => void;
  onOpenComposer: (
    mode: "whatsapp" | "sms" | "email",
    recipients: StudentsListContentMessagingRecipient[],
  ) => void;
  getColumnWidth?: (key: string) => number | undefined;
  onColumnResize?: (key: string, width: number) => void;
}

export interface StudentsListViewsProps extends StudentsListContentTableProps {
  viewMode: WorkDirectoryViewMode;
}
