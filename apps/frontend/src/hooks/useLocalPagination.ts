import { useState } from "react";

export interface UseLocalPaginationOptions<T> {
  items: T[];
  pageSize?: number;
  searchFields?: (item: T) => (string | number | null | undefined)[];
  filterFn?: (item: T, query: string) => boolean;
}

export function useLocalPagination<T>({
  items,
  pageSize = 5,
  searchFields,
  filterFn,
}: UseLocalPaginationOptions<T>) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  // Reset to the first page when the data set changes. React's documented
  // "adjust state during render" pattern — no effect, so no extra commit.
  const [previousItems, setPreviousItems] = useState(items);
  if (previousItems !== items) {
    setPreviousItems(items);
    setCurrentPage(1);
  }

  const filteredItems = (() => {
    if (!searchQuery.trim()) return items;
    const query = searchQuery.toLowerCase();

    if (filterFn) {
      return items.filter((item) => filterFn(item, query));
    }

    if (searchFields) {
      return items.filter((item) =>
        searchFields(item).some(
          (field) =>
            field !== null && field !== undefined && String(field).toLowerCase().includes(query),
        ),
      );
    }

    return items;
  })();

  const totalPages = (() => {
    return Math.max(1, Math.ceil(filteredItems.length / pageSize));
  })();

  const paginatedItems = (() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredItems.slice(startIndex, startIndex + pageSize);
  })();

  return {
    searchQuery,
    setSearchQuery,
    currentPage,
    setCurrentPage,
    handleSearchChange,
    filteredItems,
    totalPages,
    paginatedItems,
  };
}
