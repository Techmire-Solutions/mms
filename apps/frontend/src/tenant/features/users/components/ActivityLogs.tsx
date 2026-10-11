import React, { useState } from "react";
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

  const userNamesById = new Map<string, string>();
  for (const user of users) {
    userNamesById.set(user.id, user.name);
  }

  const userNameFor = (log: ActivityLog): string =>
    log.userName ?? userNamesById.get(log.userId) ?? log.userId;

  const baseFilteredLogs = (() => {
    return logs.filter((log) => {
      if (userFilter !== "all" && log.userId !== userFilter) return false;
      if (actionFilter !== "all" && log.action !== actionFilter) return false;
      if (dateFrom && log.ts < dateFrom) return false;
      if (dateTo && log.ts > `${dateTo}T23:59:59`) return false;
      return true;
    });
  })();

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
    searchFields: (log) => [userNameFor(log), log.detail],
  });

  return (
    <div className="space-y-4">
      <ActivityLogsFilters
        search={search}
        onSearchChange={setSearch}
        userFilter={userFilter}
        onUserFilterChange={setUser}
        actionFilter={actionFilter}
        onActionFilterChange={setAct}
        dateFrom={dateFrom}
        onDateFromChange={setFrom}
        dateTo={dateTo}
        onDateToChange={setTo}
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
