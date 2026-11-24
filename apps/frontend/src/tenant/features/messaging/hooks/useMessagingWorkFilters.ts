import { useCallback, useState } from "react";
import type { SetURLSearchParams } from "react-router-dom";
import { isValidIsoDate, type MessagingStatusFilter } from "@mms/contracts";
import { useDebounce } from "@/hooks/useDebounce";
import { messagingExportEndDateBound } from "../lib/messagingReportsExport";
import { useMessagingWorkTierUrlSync } from "./useMessagingWorkTierUrlSync";

export type MessagingChannelFilter = "all" | "sms" | "whatsapp" | "email";

const CHANNELS = new Set<MessagingChannelFilter>(["sms", "whatsapp", "email"]);
const STATUSES = new Set<MessagingStatusFilter>([
  "queued",
  "sending",
  "sent",
  "delivered",
  "failed",
  "skipped",
]);

export interface MessagingWorkFilterParams {
  channel: MessagingChannelFilter;
  status: MessagingStatusFilter;
  category: string;
  search: string;
  startDate: string;
  endDate: string;
  showArchived: boolean;
}

/**
 * Parses URL filter state defensively: an unknown channel/status must not reach
 * the API, and a malformed date must not produce an invalid query bound.
 */
export function parseMessagingWorkFilters(
  searchParams: URLSearchParams,
): MessagingWorkFilterParams {
  const rawChannel = searchParams.get("channel") as MessagingChannelFilter | null;
  const rawStatus = searchParams.get("status") as MessagingStatusFilter | null;
  const rawStart = searchParams.get("startDate") ?? "";
  const rawEnd = searchParams.get("endDate") ?? "";

  return {
    channel: rawChannel && CHANNELS.has(rawChannel) ? rawChannel : "all",
    status: rawStatus && STATUSES.has(rawStatus) ? rawStatus : "all",
    category: searchParams.get("category") || "all",
    search: searchParams.get("search") || "",
    startDate: isValidIsoDate(rawStart) ? rawStart : "",
    endDate: isValidIsoDate(rawEnd) ? rawEnd : "",
    showArchived: searchParams.get("archived") === "1",
  };
}

export interface UseMessagingWorkFiltersProps {
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
  controlledChannel?: MessagingChannelFilter;
  controlledOnChannelChange?: (channel: MessagingChannelFilter) => void;
  /** Archived logs are only reachable with `messaging.clearLogs`. */
  canViewArchived?: boolean;
}

export function useMessagingWorkFilters({
  searchParams,
  setSearchParams,
  controlledChannel,
  controlledOnChannelChange,
  canViewArchived = false,
}: UseMessagingWorkFiltersProps) {
  // Parse the initial URL exactly once per mount: the parse only seeds state,
  // so doing it every render was wasted work in the hottest directory hook.
  const [initial] = useState(() => parseMessagingWorkFilters(searchParams));

  const [search, setSearch] = useState(initial.search);
  const [logsPage, setLogsPage] = useState(1);
  const [internalChannel, setInternalChannel] = useState<MessagingChannelFilter>(initial.channel);
  const channel = controlledChannel !== undefined ? controlledChannel : internalChannel;
  const setChannel =
    controlledOnChannelChange !== undefined ? controlledOnChannelChange : setInternalChannel;
  const [category, setCategory] = useState(initial.category);
  const [status, setStatus] = useState<MessagingStatusFilter>(initial.status);
  const [startDate, setStartDate] = useState(initial.startDate);
  const [endDate, setEndDate] = useState(initial.endDate);
  const [showArchived, setShowArchivedState] = useState(canViewArchived && initial.showArchived);

  const debouncedSearch = useDebounce(search, 250);
  const queryStartDate = startDate.trim() || undefined;
  const queryEndDate = endDate.trim() ? messagingExportEndDateBound(endDate) : undefined;

  useMessagingWorkTierUrlSync({
    searchParams,
    setSearchParams,
    channel,
    status,
    category,
    debouncedSearch,
    startDate,
    endDate,
    showArchived,
  });

  /**
   * Any filter change starts a new result set, so the page must return to 1 —
   * otherwise the directory shows an empty page for the narrowed filters.
   * Setters are memoized: the controller builds its filter-chip remover on
   * their identities, so fresh functions per render would cascade.
   */
  const setSearchFilter = useCallback(
    (value: string): void => {
      setSearch(value);
      setLogsPage(1);
    },
    [setSearch, setLogsPage],
  );
  const setChannelFilter = useCallback(
    (value: MessagingChannelFilter): void => {
      setChannel(value);
      setLogsPage(1);
    },
    [setChannel, setLogsPage],
  );
  const setCategoryFilter = useCallback(
    (value: string): void => {
      setCategory(value);
      setLogsPage(1);
    },
    [setCategory, setLogsPage],
  );
  const setStatusFilter = useCallback(
    (value: MessagingStatusFilter): void => {
      setStatus(value);
      setLogsPage(1);
    },
    [setStatus, setLogsPage],
  );
  const setStartDateFilter = useCallback(
    (value: string): void => {
      setStartDate(value);
      setLogsPage(1);
    },
    [setStartDate, setLogsPage],
  );
  const setEndDateFilter = useCallback(
    (value: string): void => {
      setEndDate(value);
      setLogsPage(1);
    },
    [setEndDate, setLogsPage],
  );
  const setShowArchived = useCallback(
    (value: boolean): void => {
      setShowArchivedState(canViewArchived && value);
      setLogsPage(1);
    },
    [canViewArchived, setShowArchivedState, setLogsPage],
  );

  const hasActiveFilters =
    channel !== "all" ||
    category !== "all" ||
    status !== "all" ||
    Boolean(startDate) ||
    Boolean(endDate) ||
    Boolean(debouncedSearch.trim()) ||
    (canViewArchived && showArchived);

  const activeFilterCount =
    (channel !== "all" ? 1 : 0) +
    (category !== "all" ? 1 : 0) +
    (status !== "all" ? 1 : 0) +
    (startDate ? 1 : 0) +
    (endDate ? 1 : 0) +
    (canViewArchived && showArchived ? 1 : 0);

  const clearFilters = useCallback((): void => {
    setChannel("all");
    setCategory("all");
    setStatus("all");
    setStartDate("");
    setEndDate("");
    setSearch("");
    setShowArchivedState(false);
    setLogsPage(1);
  }, [
    setChannel,
    setCategory,
    setStatus,
    setStartDate,
    setEndDate,
    setSearch,
    setShowArchivedState,
    setLogsPage,
  ]);

  return {
    search,
    setSearch: setSearchFilter,
    debouncedSearch,
    logsPage,
    setLogsPage,
    channel,
    setChannel: setChannelFilter,
    category,
    setCategory: setCategoryFilter,
    status,
    setStatus: setStatusFilter,
    startDate,
    setStartDate: setStartDateFilter,
    endDate,
    setEndDate: setEndDateFilter,
    showArchived: canViewArchived && showArchived,
    setShowArchived,
    canViewArchived,
    queryStartDate,
    queryEndDate,
    hasActiveFilters,
    activeFilterCount,
    clearFilters,
  };
}
