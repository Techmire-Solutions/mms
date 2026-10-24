import type { JSX } from "react";
import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import { UserPlus } from "lucide-react";
import type { SystemUser } from "@mms/shared";
import { Button } from "@/components/ui/button";

import { EmptyState } from "@/components/app/EmptyState";
import { useTranslation } from "@/hooks/useTranslation";
import { UsersListDesktopTable } from "@/tenant/features/users/components/UsersListDesktopTable";
import { UsersListCards } from "@/tenant/features/users/components/UsersListCards";

interface UsersListContentProps {
  viewMode: WorkDirectoryViewMode;
  users: SystemUser[];
  selectedIds: string[];
  allSelected: boolean;
  someSelected: boolean;
  canWrite: boolean;
  canDelete: boolean;
  showDeleted: boolean;
  search: string;
  roleFilter: string;
  statusFilter: string;
  onAddUser: () => void;
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
  formatLoginDate: (timestamp: string) => string;
  onView: (user: SystemUser) => void;
  onEdit: (user: SystemUser) => void;
  onDelete: (id: string) => void;
  onRestore: (id: string) => void;
  onResetPassword: (user: SystemUser) => void;
  getColumnWidth?: (key: string) => number | undefined;
  onColumnResize?: (key: string, width: number) => void;
  isColumnVisible?: (key: string) => boolean;
}

export function UsersListContent({
  users,
  selectedIds,
  allSelected,
  someSelected,
  canWrite,
  canDelete,
  showDeleted,
  search,
  roleFilter,
  statusFilter,
  onAddUser,
  onToggleSelect,
  onToggleAll,
  formatLoginDate,
  onView,
  onEdit,
  onDelete,
  onRestore,
  onResetPassword,
  getColumnWidth,
  onColumnResize,
  isColumnVisible,
  viewMode,
}: UsersListContentProps): JSX.Element {
  const { t } = useTranslation();

  if (users.length === 0) {
    return (
      <EmptyState
        icon={UserPlus}
        title={t("users.emptyTitle")}
        description={
          showDeleted || search || roleFilter !== "all" || statusFilter !== "all"
            ? t("users.emptyFiltered")
            : t("users.emptyHint")
        }
        action={
          canWrite && !showDeleted && !search && roleFilter === "all" && statusFilter === "all" ? (
            <Button type="button" onClick={onAddUser}>
              <UserPlus className="h-3.5 w-3.5" />
              {t("users.addFirst")}
            </Button>
          ) : null
        }
      />
    );
  }

  const listProps = {
    users,
    selectedIds,
    allSelected,
    someSelected,
    canWrite,
    canDelete,
    showDeleted,
    formatLoginDate,
    onToggleSelect,
    onToggleAll,
    onView,
    onEdit,
    onDelete,
    onRestore,
    onResetPassword,
    isColumnVisible,
  };

  if (viewMode === "cards") {
    return <UsersListCards {...listProps} />;
  }

  return (
    <UsersListDesktopTable
      {...listProps}
      getColumnWidth={getColumnWidth}
      onColumnResize={onColumnResize}
      isColumnVisible={isColumnVisible}
    />
  );
}
