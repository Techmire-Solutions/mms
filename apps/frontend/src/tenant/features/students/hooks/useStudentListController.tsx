import { type Student } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import type { StudentsListContentSortField } from "@/tenant/features/students/lib/studentsListTypes";
import type { useMessageComposerState } from "@/hooks/useMessageComposerState";

interface UseStudentsListContentControllerOptions {
  students: Student[];
  onSelectOne: (id: string) => void;
  onSelectAll: (pageIds: string[]) => void;
  allSelected: boolean;
  someSelected: boolean;
  isColumnVisible: (key: string) => boolean;
  onSort: (field: StudentsListContentSortField) => void;
  openComposer: ReturnType<typeof useMessageComposerState>["openComposer"];
  canWriteMessaging: boolean;
}

export function useStudentListController({
  students,
  onSelectOne,
  onSelectAll,
  allSelected,
  someSelected,
  isColumnVisible,
  onSort,
  openComposer,
  canWriteMessaging,
}: UseStudentsListContentControllerOptions) {
  const { t } = useTranslation();

  const handleSort = (field: StudentsListContentSortField) => {
    onSort(field);
  };

  const pageIds = students.map((student) => String(student.id));

  const handleSelectAll = () => {
    onSelectAll(pageIds);
  };

  return {
    t,
    isColumnVisible,
    openComposer,
    canWriteMessaging,
    paginatedStudents: students,
    allSelected,
    someSelected,
    handleSort,
    handleSelectAll,
    handleSelectOne: onSelectOne,
  };
}
