import { useState } from "react";
import type { SetURLSearchParams } from "react-router-dom";
import { isValidIsoDate } from "@mms/shared";
import { useDebounce } from "@/hooks/useDebounce";
import { messagingExportEndDateBound } from "../lib/messagingReportsExport";
import { useMessagingWorkTierUrlSync } from "./useMessagingWorkTierUrlSync";

export type MessagingChannelFilter = "all" | "sms" | "whatsapp" | "email";
export type MessagingStatusFilter = "all" | "sent" | "delivered" | "failed" | "skipped";

const CHANNELS = new Set<MessagingChannelFilter>(["sms", "whatsapp", "email"]);
const STATUSES = new Set<MessagingStatusFilter>(["sent", "delivered", "failed", "skipped"]);

export interface MessagingWorkFilterParams {
  channel: MessagingChannelFilter;
  status: MessagingStatusFilter;
  category: string;
  search: string;
  startDate: string;
  endDate: string;
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
  };
}

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
  const initial = parseMessagingWorkFilters(searchParams);

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
