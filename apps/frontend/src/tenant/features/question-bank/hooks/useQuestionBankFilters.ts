import { useEffect, useState } from "react";
import { QUESTION_BANK_MODULE_MANIFEST, type QuestionBankQuestion as Question } from "@mms/shared";
import { useDebounce } from "@/hooks/useDebounce";
import { useQuestionBankContractList } from "@/tenant/features/question-bank/hooks/useQuestionBankQueries";

const QUESTION_SEARCH_DEBOUNCE_MS = 300;

interface UseQuestionBankFiltersOptions {
  showDeleted?: boolean;
  onFilteredCountChange?: (count: number) => void;
}

/**
 * Owns the Work questions filter state + SQL-paged query. The list display reads
 * `pageQuestions`/`serverTotal` from the server; the full question list stays
 * with the controller for `useQuestionBankConfig` (category/difficulty options)
 * and PaperBuilder.
 */
export function useQuestionBankFilters({
  showDeleted = false,
  onFilteredCountChange,
}: UseQuestionBankFiltersOptions) {
  const [search, setSearch] = useState("");
  const [filterCats, setFilterCats] = useState<string[]>([]);
  const [filterDiff, setFilterDiff] = useState<string[]>([]);
  const [listPage, setListPage] = useState(1);

  const debouncedSearch = useDebounce(search, QUESTION_SEARCH_DEBOUNCE_MS);

  // Server-side filter/page reset whenever a filter dimension changes.
  const filterKey = `${debouncedSearch}|${filterCats.join(",")}|${filterDiff.join(",")}|${String(showDeleted)}`;
  const [previousFilterKey, setPreviousFilterKey] = useState(filterKey);
  if (previousFilterKey !== filterKey) {
    setPreviousFilterKey(filterKey);
    setListPage(1);
  }

  const pageQuery = useQuestionBankContractList({
    page: listPage,
    limit: QUESTION_BANK_MODULE_MANIFEST.defaultPageSize,
    search: debouncedSearch,
    categoryId: filterCats.length ? filterCats.join(",") : undefined,
    difficulty: filterDiff.length ? filterDiff.join(",") : undefined,
    includeDeleted: showDeleted,
  });

  const pageQuestions: Question[] = (pageQuery.data?.body?.questions ?? []) as Question[];
  const serverTotal = pageQuery.data?.body?.total ?? 0;
  const serverPage = pageQuery.data?.body?.page ?? listPage;
  const serverLimit = pageQuery.data?.body?.limit ?? QUESTION_BANK_MODULE_MANIFEST.defaultPageSize;
  const serverHasMore = pageQuery.data?.body?.hasMore ?? false;

  useEffect(() => {
    onFilteredCountChange?.(serverTotal);
  }, [onFilteredCountChange, serverTotal]);

  return {
    search,
    setSearch,
    filterCats,
    setFilterCats,
    filterDiff,
    setFilterDiff,
    listPage,
    setListPage,
    pageQuestions,
    pageQuery,
    serverTotal,
    serverPage,
    serverLimit,
    serverHasMore,
  };
}
