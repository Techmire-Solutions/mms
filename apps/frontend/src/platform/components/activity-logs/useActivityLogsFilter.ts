import { useMemo, useDeferredValue } from "react";
import { useSearchParams } from "react-router-dom";
import { getActionCategory, type LogCategory } from "./activityLogMeta";
import type { PlatformActivityLogItem } from "@/platform/hooks/usePlatformActivityLogs";

export type LogTimeframe = "all" | "today" | "7d" | "30d";

export function useActivityLogsFilter(logs: PlatformActivityLogItem[] | undefined) {
  const [searchParams, setSearchParams] = useSearchParams();
  const filterQuery = searchParams.get("q") ?? "";
  const category = (searchParams.get("cat") as LogCategory) ?? "all";
  const timeframe = (searchParams.get("time") as LogTimeframe) ?? "all";

  const deferredQuery = useDeferredValue(filterQuery);

  const setFilterQuery = (q: string) => {
    setSearchParams(
      (p) => {
        if (q) p.set("q", q);
        else p.delete("q");
        return p;
      },
      { replace: true },
    );
  };

  const setCategory = (cat: LogCategory) => {
    setSearchParams(
      (p) => {
        if (cat === "all") p.delete("cat");
        else p.set("cat", cat);
        return p;
      },
      { replace: true },
    );
  };

  const setTimeframe = (time: LogTimeframe) => {
    setSearchParams(
      (p) => {
        if (time === "all") p.delete("time");
        else p.set("time", time);
        return p;
      },
      { replace: true },
    );
  };

  const handleClearFilters = () => {
    setSearchParams(
      (p) => {
        p.delete("q");
        p.delete("cat");
        p.delete("time");
        return p;
      },
      { replace: true },
    );
  };

  const isFiltered = Boolean(filterQuery || category !== "all" || timeframe !== "all");

  const items = useMemo(() => {
    const raw = logs ?? [];
    const now = Date.now();
    const q = deferredQuery.trim().toLowerCase();

    return raw.filter((l) => {
      if (q) {
        const matchesText =
          l.action.toLowerCase().includes(q) ||
          l.userEmail.toLowerCase().includes(q) ||
          (l.targetResource && l.targetResource.toLowerCase().includes(q)) ||
          (l.targetId && l.targetId.toLowerCase().includes(q)) ||
          (l.metadataMessage && l.metadataMessage.toLowerCase().includes(q)) ||
          (l.ipAddress && l.ipAddress.toLowerCase().includes(q));
        if (!matchesText) return false;
      }

      if (category !== "all" && getActionCategory(l.action) !== category) return false;

      if (timeframe !== "all") {
        const created = new Date(l.createdAt).getTime();
        if (!Number.isFinite(created)) return true;
        if (timeframe === "today") {
          if (created < new Date().setHours(0, 0, 0, 0)) return false;
        } else if (timeframe === "7d") {
          if (created < now - 7 * 24 * 60 * 60 * 1000) return false;
        } else if (timeframe === "30d") {
          if (created < now - 30 * 24 * 60 * 60 * 1000) return false;
        }
      }

      return true;
    });
  }, [logs, deferredQuery, category, timeframe]);

  return {
    filterQuery,
    setFilterQuery,
    category,
    setCategory,
    timeframe,
    setTimeframe,
    handleClearFilters,
    isFiltered,
    items,
  };
}
