import { useState, useEffect } from "react";
import type { Exam } from "@/lib/data/examinationData";
import { useDebounce } from "@/hooks/useDebounce";
import { EXAMINATIONS_MODULE_MANIFEST } from "@mms/shared";
import { useExaminationsContractList } from "@/tenant/features/examinations/hooks/useExaminationsTsrHooks";

const EXAM_SEARCH_DEBOUNCE_MS = 300;

export interface UseExaminationsDirectoryQueryProps {
  showDeleted?: boolean;
  onFilteredCountChange?: (count: number) => void;
}

export function useExaminationsDirectoryQuery({
  showDeleted = false,
  onFilteredCountChange,
}: UseExaminationsDirectoryQueryProps) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [listPage, setListPage] = useState(1);

  const debouncedSearch = useDebounce(search, EXAM_SEARCH_DEBOUNCE_MS);

  // Server-side filter/page reset whenever a filter dimension changes.
  useEffect(() => {
    setListPage(1);
  }, [debouncedSearch, filterStatus, showDeleted]);

  const examsPageQuery = useExaminationsContractList({
    page: listPage,
    limit: EXAMINATIONS_MODULE_MANIFEST.defaultPageSize,
    search: debouncedSearch,
    status: filterStatus.length ? filterStatus.join(",") : undefined,
    includeDeleted: showDeleted,
  });

  const pageExams = (examsPageQuery.data?.body?.exams ?? []) as Exam[];
  const serverTotal = examsPageQuery.data?.body?.total ?? 0;
  const serverPage = examsPageQuery.data?.body?.page ?? listPage;
  const serverLimit =
    examsPageQuery.data?.body?.limit ?? EXAMINATIONS_MODULE_MANIFEST.defaultPageSize;
  const serverHasMore = examsPageQuery.data?.body?.hasMore ?? false;

  useEffect(() => {
    onFilteredCountChange?.(serverTotal);
  }, [onFilteredCountChange, serverTotal]);

  const toggleStatus = (status: string): void =>
    setFilterStatus((currentStatuses) =>
      currentStatuses.includes(status)
        ? currentStatuses.filter((candidate) => candidate !== status)
        : [...currentStatuses, status],
    );

  const clearStatuses = (): void => setFilterStatus([]);

  return {
    search,
    setSearch,
    filterStatus,
    setFilterStatus,
    toggleStatus,
    clearStatuses,
    listPage,
    setListPage,
    debouncedSearch,
    examsPageQuery,
    pageExams,
    serverTotal,
    serverPage,
    serverLimit,
    serverHasMore,
  };
}
