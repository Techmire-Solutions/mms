import { useState } from "react";
import type { SetURLSearchParams } from "react-router-dom";
import { useDebounce } from "@/hooks/useDebounce";
import { messagingExportEndDateBound } from "./messagingReportsExport";
import { useMessagingWorkTierUrlSync } from "./useMessagingWorkTierUrlSync";

export type MessagingChannelFilter = "all" | "sms" | "whatsapp" | "email";
export type MessagingStatusFilter = "all" | "sent" | "delivered" | "failed" | "skipped";

export interface UseMessagingWorkFiltersProps {
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
  controlledChannel?: MessagingChannelFilter;
  controlledOnChannelChange?: (channel: MessagingChannelFilter) => void;
}

export function useMessagingWorkFilters({
  searchParams,
  setSearchParams,
  controlledChannel,
  controlledOnChannelChange,
}: UseMessagingWorkFiltersProps) {
  const channelParam = searchParams.get("channel") as MessagingChannelFilter | null;
  const statusParam = searchParams.get("status") as MessagingStatusFilter | null;
  const categoryParam = searchParams.get("category") || null;
  const searchParam = searchParams.get("search") || "";

  const [search, setSearch] = useState(searchParam);
  const [logsPage, setLogsPage] = useState(1);
  const [internalChannel, setInternalChannel] = useState<MessagingChannelFilter>(
    channelParam || "all",
  );
  const channel = controlledChannel !== undefined ? controlledChannel : internalChannel;
  const setChannel =
    controlledOnChannelChange !== undefined ? controlledOnChannelChange : setInternalChannel;
  const [category, setCategory] = useState(categoryParam || "all");
  const [status, setStatus] = useState<MessagingStatusFilter>(statusParam || "all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

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
  });

  const hasActiveFilters =
    channel !== "all" ||
    category !== "all" ||
    status !== "all" ||
    Boolean(startDate) ||
    Boolean(endDate) ||
    Boolean(debouncedSearch.trim());

  const activeFilterCount =
    (channel !== "all" ? 1 : 0) +
    (category !== "all" ? 1 : 0) +
    (status !== "all" ? 1 : 0) +
    (startDate ? 1 : 0) +
    (endDate ? 1 : 0);

  const clearFilters = (): void => {
    setChannel("all");
    setCategory("all");
    setStatus("all");
    setStartDate("");
    setEndDate("");
    setSearch("");
    setLogsPage(1);
  };

  return {
    search,
    setSearch,
    debouncedSearch,
    logsPage,
    setLogsPage,
    channel,
    setChannel,
    category,
    setCategory,
    status,
    setStatus,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    queryStartDate,
    queryEndDate,
    hasActiveFilters,
    activeFilterCount,
    clearFilters,
  };
}
