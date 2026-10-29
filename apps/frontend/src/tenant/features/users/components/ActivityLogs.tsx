import React, { useCallback, useMemo, useState } from "react";
import { type ActivityLog, type SystemUser, type WorkspaceUser } from "@mms/shared";
import { useLocalPagination } from "@/hooks/useLocalPagination";
import { useWorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import type { DataTableColumnLayout } from "@/components/common/data-table";
import { ActivityLogsFilters } from "@/tenant/features/users/components/ActivityLogsFilters";
import { ActivityLogsList } from "@/tenant/features/users/components/ActivityLogsList";

const PAGE_SIZE = 15;

export interface ActivityLogsProps {
  logs: ActivityLog[];
  users: Array<SystemUser | WorkspaceUser>;
  columnLayout?: DataTableColumnLayout;
}

export function ActivityLogs({ logs, users, columnLayout }: ActivityLogsProps): React.JSX.Element {
  const [userFilter, setUser] = useState("all");
  const [actionFilter, setAct] = useState("all");
  const [dateFrom, setFrom] = useState("");
  const [dateTo, setTo] = useState("");
  const { viewMode, setViewMode } = useWorkDirectoryViewMode();

  const userNamesById = useMemo(() => {
    const map = new Map<string, string>();
    for (const user of users) {
      map.set(user.id, user.name);
    }
    return map;
  }, [users]);

  const userNameFor = useCallback(
    (log: ActivityLog): string => log.userName ?? userNamesById.get(log.userId) ?? log.userId,
    [userNamesById],
  );

  const baseFilteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (userFilter !== "all" && log.userId !== userFilter) return false;
      if (actionFilter !== "all" && log.action !== actionFilter) return false;
      if (dateFrom && log.ts < dateFrom) return false;
      if (dateTo && log.ts > `${dateTo}T23:59:59`) return false;
      return true;
    });
  }, [logs, userFilter, actionFilter, dateFrom, dateTo]);

  const searchFields = useCallback(
    (log: ActivityLog) => [userNameFor(log), log.detail],
    [userNameFor],
  );

  const {
    searchQuery: search,
    setSearchQuery: setSearch,
    currentPage: page,
    setCurrentPage: setPage,
    paginatedItems: paginated,
    filteredItems: filtered,
  } = useLocalPagination({
    items: baseFilteredLogs,
    pageSize: PAGE_SIZE,
    searchFields,
  });

  const handleUserFilterChange = (val: string) => {
    setUser(val);
    setPage(1);
  };

  const handleActionFilterChange = (val: string) => {
    setAct(val);
    setPage(1);
  };

  const handleDateFromChange = (val: string) => {
    setFrom(val);
    setPage(1);
  };

  const handleDateToChange = (val: string) => {
    setTo(val);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <ActivityLogsFilters
        search={search}
        onSearchChange={setSearch}
        userFilter={userFilter}
        onUserFilterChange={handleUserFilterChange}
        actionFilter={actionFilter}
        onActionFilterChange={handleActionFilterChange}
        dateFrom={dateFrom}
        onDateFromChange={handleDateFromChange}
        dateTo={dateTo}
        onDateToChange={handleDateToChange}
        users={users}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        columnLayout={columnLayout}
      />

      <ActivityLogsList
        paginated={paginated}
        filteredCount={filtered.length}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        userNameFor={userNameFor}
        viewMode={viewMode}
        columnLayout={columnLayout}
      />
    </div>
  );
}
