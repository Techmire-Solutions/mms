import { type Student } from "@mms/shared";
import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import type { useMessageComposerState } from "@/hooks/useMessageComposerState";
import { StudentsListViews } from "@/tenant/features/students/components/StudentsListViews";
import { useStudentListController } from "@/tenant/features/students/hooks/useStudentListController";
import type { StudentsListContentSortField } from "@/tenant/features/students/lib/studentsListTypes";
import { useSessionsCollection } from "@/tenant/hooks/collections/sessions";
import { studentStatusBadgeConfig } from "@/lib/students/studentStatusUi";

export interface StudentsListContentProps {
  students: Student[];
  onEdit: (student: Student) => void;
  onRestore?: (id: string) => void | Promise<void>;
  viewMode: WorkDirectoryViewMode;
  isColumnVisible: (key: string) => boolean;
  columnRegistry?: import("@mms/shared").ModuleColumnRegistryEntry[];
  getColumnWidth?: (key: string) => number | undefined;
  onColumnResize?: (key: string, width: number) => void;
  sortField: StudentsListContentSortField | null;
  sortDir: "asc" | "desc";
  onServerSort: (field: StudentsListContentSortField) => void;
  selectedIds: string[];
  allSelected: boolean;
  someSelected: boolean;
  onSelectOne: (id: string) => void;
  onSelectAll: (pageIds: string[]) => void;
  viewingDeleted?: boolean;
  canWrite?: boolean;
  canDelete?: boolean;
  onViewStudent: (student: Student | null) => void;
  openComposer: ReturnType<typeof useMessageComposerState>["openComposer"];
  canWriteMessaging: boolean;
  onDeleteTargetChange: (target: { id: string; name?: string } | null) => void;
}

/** Students directory content only — form / drawer / composer / confirms mount on page overlays. */
export function StudentsListContent({
  students,
  onEdit,
  onRestore,
  viewMode,
  isColumnVisible,
  columnRegistry = [],
  getColumnWidth,
  onColumnResize,
  sortField,
  sortDir,
  onServerSort,
  selectedIds,
  allSelected,
  someSelected,
  onSelectOne,
  onSelectAll,
  viewingDeleted = false,
  canWrite = true,
  canDelete = true,
  onViewStudent,
  openComposer,
  canWriteMessaging,
  onDeleteTargetChange,
}: StudentsListContentProps): React.JSX.Element {
  const sessions = useSessionsCollection();
  const list = useStudentListController({
    students,
    onSelectOne,
    onSelectAll,
    allSelected,
    someSelected,
    isColumnVisible,
    onSort: onServerSort,
    openComposer,
    canWriteMessaging,
  });
  const statusBadgeConfig = studentStatusBadgeConfig(list.t);

  const handleRestore = async (studentId: string): Promise<void> => {
    if (!onRestore) return;
    await onRestore(studentId);
    onViewStudent(null);
  };

  return (
    <div className="space-y-4">
      <StudentsListViews
        paginatedStudents={list.paginatedStudents}
        sessions={sessions}
        viewMode={viewMode}
        selectedIds={selectedIds}
        allSelected={list.allSelected}
        someSelected={list.someSelected}
        viewingDeleted={viewingDeleted}
        canWrite={canWrite}
        canDelete={canDelete}
        canWriteMessaging={list.canWriteMessaging}
        statusBadgeConfig={statusBadgeConfig}
        isColumnVisible={list.isColumnVisible}
        columnRegistry={columnRegistry}
        sortField={sortField}
        sortDir={sortDir}
        onSort={list.handleSort}
        onSelectAll={list.handleSelectAll}
        onSelectOne={list.handleSelectOne}
        onViewStudent={onViewStudent}
        onEdit={onEdit}
        onDelete={(studentId) => {
          const match = students.find((row) => String(row.id) === String(studentId));
          onDeleteTargetChange({
            id: String(studentId),
            name: match?.name?.trim() || undefined,
          });
        }}
        onRestore={onRestore ? handleRestore : undefined}
        onOpenComposer={list.openComposer}
        getColumnWidth={getColumnWidth}
        onColumnResize={onColumnResize}
      />
    </div>
  );
}

export default StudentsListContent;
