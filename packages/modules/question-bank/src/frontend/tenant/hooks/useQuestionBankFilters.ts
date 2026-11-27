import { useEffect, useState } from "react";
import {
  QUESTION_BANK_MODULE_MANIFEST,
  type QuestionBankQuestion as Question,
  type QuestionStatus,
  type QuestionType,
} from "@mms/contracts";
import { useDebounce } from "@mms/fe-core/hooks";
import { useQuestionBankContractList } from "./useQuestionBankQueries";

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
  /** Single-select workflow facets; the API accepts one status/type per query. */
  const [filterStatus, setFilterStatus] = useState<QuestionStatus | "">("");
  const [filterType, setFilterType] = useState<QuestionType | "">("");
  const [listPage, setListPage] = useState(1);

  const debouncedSearch = useDebounce(search, QUESTION_SEARCH_DEBOUNCE_MS);

  // Server-side filter/page reset whenever a filter dimension changes. The reset
  // uses React's documented adjust-state-during-render pattern; the query below
  // already reads the corrected page so no stale-page request is ever issued.
  const filterKey = `${debouncedSearch}|${filterCats.join(",")}|${filterDiff.join(",")}|${filterStatus}|${filterType}|${String(showDeleted)}`;
  const [previousFilterKey, setPreviousFilterKey] = useState(filterKey);
  const pageForQuery = previousFilterKey !== filterKey ? 1 : listPage;
  if (previousFilterKey !== filterKey) {
    setPreviousFilterKey(filterKey);
    setListPage(1);
  }

  const pageQuery = useQuestionBankContractList({
    page: pageForQuery,
    limit: QUESTION_BANK_MODULE_MANIFEST.defaultPageSize,
    search: debouncedSearch,
    categoryId: filterCats.length ? filterCats.join(",") : undefined,
    difficulty: filterDiff.length ? filterDiff.join(",") : undefined,
    status: filterStatus || undefined,
    type: filterType || undefined,
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
    filterStatus,
    setFilterStatus,
    filterType,
    setFilterType,
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
