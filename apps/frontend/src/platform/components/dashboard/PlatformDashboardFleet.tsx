import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { usePlatformPermissions } from "@/platform/hooks/usePlatformPermissions";
import { usePlatformWorkspaces } from "@/platform/hooks/usePlatformWorkspaces";
import {
  PlatformDashboardFleetControls,
  type FleetStatusFilter,
} from "@/platform/components/dashboard/PlatformDashboardFleetControls";
import { PlatformDashboardFleetTable } from "@/platform/components/dashboard/PlatformDashboardFleetTable";
import { ConfirmAlertDialog } from "@/components/app/ConfirmAlertDialog";
import { notify } from "@/lib/notify";

const PAGE_SIZE = 5;
const REFRESH_MS = 60_000;

/** Zones C–G — fleet filters, table, confirm modal; row click opens inspector. */
export function PlatformDashboardFleet(): React.JSX.Element | null {
  const { t } = useTranslation();
  const { canWorkspaces } = usePlatformPermissions();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<FleetStatusFilter>("all");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [exportOpen, setExportOpen] = useState(false);

  const { data, total, isLoading, refetch } = usePlatformWorkspaces({
    page,
    limit: PAGE_SIZE,
    search: search.trim() || undefined,
    status,
    sortField: "name",
    sortDir,
  });

  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [search, status, sortDir]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => {
      void refetch();
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [autoRefresh, refetch]);

  const rows = data ?? [];
  const filteredByDate = rows.filter((row) => {
    if (!dateFrom && !dateTo) return true;
    const created = row.createdAt?.slice(0, 10) ?? "";
    if (dateFrom && created < dateFrom) return false;
    if (dateTo && created > dateTo) return false;
    return true;
  });

  const onToggleSelect = useCallback((subdomain: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(subdomain)) next.delete(subdomain);
      else next.add(subdomain);
      return next;
    });
  }, []);

  const onToggleSelectAll = useCallback(
    (checked: boolean) => {
      setSelected(checked ? new Set(filteredByDate.map((r) => r.subdomain)) : new Set());
    },
    [filteredByDate],
  );

  if (!canWorkspaces) return null;

  return (
    <div className="space-y-4" data-testid="dashboard-fleet">
      <h2 className="text-sm font-bold text-foreground text-balance">
        {t("platform.fleetDirectory")}
      </h2>
      <PlatformDashboardFleetControls
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={setStatus}
        autoRefresh={autoRefresh}
        onAutoRefreshChange={setAutoRefresh}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
      />
      <PlatformDashboardFleetTable
        rows={filteredByDate}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        isLoading={isLoading}
        selected={selected}
        onToggleSelect={onToggleSelect}
        onToggleSelectAll={onToggleSelectAll}
        onPageChange={setPage}
        sortDir={sortDir}
        onToggleSort={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
        onRequestExport={() => setExportOpen(true)}
      />
      <ConfirmAlertDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        title={t("platform.fleetExportTitle")}
        description={t("platform.fleetExportHint", { count: selected.size })}
        confirmLabel={t("platform.workspaces.exportSelected")}
        onConfirm={() => {
          notify.success(t("platform.fleetExportQueued", { count: selected.size }));
          setSelected(new Set());
        }}
      />
    </div>
  );
}
