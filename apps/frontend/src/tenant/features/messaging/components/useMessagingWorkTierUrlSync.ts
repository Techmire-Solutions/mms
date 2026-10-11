import { useEffect } from "react";
import type { SetURLSearchParams } from "react-router-dom";

interface UseMessagingWorkTierUrlSyncParams {
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
  channel: "all" | "sms" | "whatsapp" | "email";
  status: "all" | "sent" | "delivered" | "failed" | "skipped";
  category: string;
  debouncedSearch: string;
}

export function useMessagingWorkTierUrlSync({
  searchParams,
  setSearchParams,
  channel,
  status,
  category,
  debouncedSearch,
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

    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [channel, status, category, debouncedSearch, searchParams, setSearchParams]);
}
