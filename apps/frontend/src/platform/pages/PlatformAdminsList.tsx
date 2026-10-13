import React, { useState, useDeferredValue, useMemo } from "react";
import { ShieldCheck } from "lucide-react";
import type { PlatformUserProfile } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useWorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import { DETAIL_SECTION_TITLE } from "@/components/ui/formStyles";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { ModuleWorkListStateShell } from "@/components/app/ModuleWorkListStateShell";
import { exportPlatformAdminsCsv } from "@/platform/components/admin/exportPlatformAdminsCsv";
import { PlatformAdminsToolbar } from "@/platform/components/admin/PlatformAdminsToolbar";
import { PlatformAdminBulkDock } from "@/platform/components/admin/PlatformAdminBulkDock";
import { PlatformAdminsListCards } from "@/platform/components/admin/PlatformAdminsListCards";
import {
  PlatformAdminsTableView,
  type DangerMode,
} from "@/platform/components/admin/PlatformAdminsTableView";
import { PlatformAdminsDialogs } from "@/platform/components/admin/PlatformAdminsDialogs";
import { usePlatformAdminSelection } from "@/platform/components/admin/usePlatformAdminSelection";
import { useVerifyPlatformAdminEmail } from "@/platform/hooks/usePlatformAdmins";
import { usePlatformUserDescriptor } from "@/platform/hooks/usePlatformUserDescriptor";
import { useDescriptorColumnLayout } from "@/hooks/useDescriptorColumnLayout";

export type AdminRoleFilter = "all" | "super_user" | "admin";

interface PlatformAdminsListProps {
  admins: PlatformUserProfile[] | undefined;
  loading: boolean;
  fetchError: boolean;
  onRetry: () => void;
}

export function PlatformAdminsList({
  admins,
  loading,
  fetchError,
  onRetry,
}: PlatformAdminsListProps): React.JSX.Element {
  const { t } = useTranslation();
  const descriptor = usePlatformUserDescriptor();
  const columnLayout = useDescriptorColumnLayout("platform.admins", descriptor);
  const { viewMode, setViewMode } = useWorkDirectoryViewMode();
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<AdminRoleFilter>("all");
  const [editingAdmin, setEditingAdmin] = useState<PlatformUserProfile | null>(null);
  const [dangerAdmin, setDangerAdmin] = useState<PlatformUserProfile | null>(null);
  const [dangerMode, setDangerMode] = useState<DangerMode>("disable");
  const [inspectAdmin, setInspectAdmin] = useState<PlatformUserProfile | null>(null);

  const rawItems = useMemo(() => admins ?? [], [admins]);
  const deferredQuery = useDeferredValue(searchQuery);

  const {
    selectedAdminSet,
    selectedAdmins,
    selectedCount,
    handleToggleSelect,
    handleToggleSelectAll,
    clearSelection,
  } = usePlatformAdminSelection(rawItems);

  const verifyEmailMutation = useVerifyPlatformAdminEmail();

  const openDanger = (admin: PlatformUserProfile, mode: DangerMode): void => {
    setDangerAdmin(admin);
    setDangerMode(mode);
  };

  const superUserCount = rawItems.filter((a) => a.role === "super_user").length;
  const adminCount = rawItems.filter((a) => a.role === "admin").length;

  const filteredItems = useMemo(() => {
    let list = rawItems;
    if (roleFilter !== "all") {
      list = list.filter((a) => a.role === roleFilter);
    }
    if (!deferredQuery.trim()) return list;
    const q = deferredQuery.trim().toLowerCase();
    return list.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.role.toLowerCase().includes(q),
    );
  }, [rawItems, roleFilter, deferredQuery]);

  const hasActiveFilters = Boolean(searchQuery || roleFilter !== "all");
  const handleClearFilters = (): void => {
    setSearchQuery("");
    setRoleFilter("all");
  };

  const actionProps = {
    descriptor,
    onInspect: setInspectAdmin,
    onEditAccess: setEditingAdmin,
    onToggleStatus: openDanger,
    onDelete: (a: PlatformUserProfile) => openDanger(a, "delete"),
    verifyPending: verifyEmailMutation.isPending,
    onVerifyEmail: (id: string) => verifyEmailMutation.mutate(id),
    selectedIds: selectedAdminSet,
    onToggleSelect: handleToggleSelect,
    onToggleSelectAll: () => handleToggleSelectAll(filteredItems),
  };

  return (
    <div className="lg:col-span-2 space-y-4 text-start">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className={`${DETAIL_SECTION_TITLE} text-balance`}>
          {t("platform.manageAdmins")} ({rawItems.length})
        </h2>
      </div>

      <PlatformAdminsToolbar
        shownCount={filteredItems.length}
        totalCount={rawItems.length}
        superUserCount={superUserCount}
        adminCount={adminCount}
        search={searchQuery}
        onSearchChange={setSearchQuery}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
        roleFilter={roleFilter}
        onRoleFilterChange={setRoleFilter}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onExportCsv={() => exportPlatformAdminsCsv(filteredItems, descriptor)}
        columnLayout={columnLayout}
      />

      <ModuleWorkListStateShell
        isError={fetchError}
        isLoading={loading}
        isFetching={false}
        onRetry={onRetry}
        errorTitle={t("platform.loadFailed")}
        errorHint={t("platform.loadFailedHint")}
        viewMode={viewMode}
        skeletonColumnCount={4}
        useServerWork={false}
        pageData={null}
        onPageChange={() => {}}
        i18nNamespace="platform"
        showPagination={false}
        loadingLabel={t("common.loading")}
      >
        {filteredItems.length === 0 ? (
          <div className="bg-card border border-border/40 rounded-xl p-6">
            <EmptyState
              icon={ShieldCheck}
              title={hasActiveFilters ? t("platform.noMatchingAdmins") : t("platform.noAdmins")}
              action={
                hasActiveFilters ? (
                  <Button variant="outline" onClick={handleClearFilters}>
                    {t("common.clearFilters")}
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : viewMode === "table" ? (
          <PlatformAdminsTableView
            admins={filteredItems}
            columnLayout={columnLayout}
            {...actionProps}
          />
        ) : (
          <PlatformAdminsListCards admins={filteredItems} {...actionProps} />
        )}
      </ModuleWorkListStateShell>

      <PlatformAdminBulkDock
        selectedCount={selectedCount}
        selectedAdmins={selectedAdmins}
        onClearSelection={clearSelection}
        onBulkExport={() => exportPlatformAdminsCsv(selectedAdmins, descriptor)}
      />

      <PlatformAdminsDialogs
        editingAdmin={editingAdmin}
        onCloseEditing={() => setEditingAdmin(null)}
        dangerAdmin={dangerAdmin}
        dangerMode={dangerMode}
        onCloseDanger={() => setDangerAdmin(null)}
        inspectAdmin={inspectAdmin}
        onCloseInspect={() => setInspectAdmin(null)}
        descriptor={descriptor}
      />
    </div>
  );
}
