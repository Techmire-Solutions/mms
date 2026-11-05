import { useEffect } from "react";
import type { SetURLSearchParams } from "react-router-dom";

interface UseMessagingWorkTierUrlSyncParams {
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
  channel: "all" | "sms" | "whatsapp" | "email";
  status: "all" | "sent" | "delivered" | "failed" | "skipped";
  category: string;
  debouncedSearch: string;
  startDate: string;
  endDate: string;
  showArchived?: boolean;
}

export function useMessagingWorkTierUrlSync({
  searchParams,
  setSearchParams,
  channel,
  status,
  category,
  debouncedSearch,
  startDate,
  endDate,
  showArchived = false,
}: UseMessagingWorkTierUrlSyncParams): void {
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (channel !== "all") next.set("channel", channel);
    else next.delete("channel");

    if (status !== "all") next.set("status", status);
    else next.delete("status");

    if (category !== "all") next.set("category", category);
    else next.delete("category");

    if (debouncedSearch.trim()) next.set("search", debouncedSearch.trim());
    else next.delete("search");

    if (startDate.trim()) next.set("startDate", startDate.trim());
    else next.delete("startDate");

    if (endDate.trim()) next.set("endDate", endDate.trim());
    else next.delete("endDate");

    if (showArchived) next.set("archived", "1");
    else next.delete("archived");

    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [
    channel,
    status,
    category,
    debouncedSearch,
    startDate,
    endDate,
    showArchived,
    searchParams,
    setSearchParams,
  ]);
}
