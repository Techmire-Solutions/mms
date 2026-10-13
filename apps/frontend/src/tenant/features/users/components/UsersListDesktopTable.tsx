import React, { type JSX } from "react";
import type { SystemUser } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { UserAvatar } from "@/components/app/UserAvatar";
import { UsersRowActions } from "@/tenant/features/users/components/UsersRowActions";
import { renderUserWorkColumnValue } from "@/tenant/features/users/components/userWorkColumnCell";
import { WorkBatchTable, type WorkBatchTableColumn } from "@/components/common/work";

interface UsersListDesktopTableProps {
  users: SystemUser[];
  selectedIds: string[];
  allSelected: boolean;
  someSelected: boolean;
  canWrite: boolean;
  canDelete: boolean;
  showDeleted: boolean;
  formatLoginDate: (timestamp: string) => string;
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
  onView: (user: SystemUser) => void;
  onEdit: (user: SystemUser) => void;
  onDelete: (id: string) => void;
  onRestore: (id: string) => void;
  onResetPassword: (user: SystemUser) => void;
  getColumnWidth?: (key: string) => number | undefined;
  onColumnResize?: (key: string, width: number) => void;
  isColumnVisible?: (key: string) => boolean;
}

export function UsersListDesktopTable({
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
  getColumnWidth,
  onColumnResize,
  isColumnVisible,
}: UsersListDesktopTableProps): JSX.Element {
  const { t } = useTranslation();
  const visible = isColumnVisible ?? (() => true);
  const columnContext = React.useMemo(() => ({ t, formatLoginDate }), [t, formatLoginDate]);

  const columns = React.useMemo<WorkBatchTableColumn<SystemUser>[]>(() => {
    const cols: WorkBatchTableColumn<SystemUser>[] = [
      {
        id: "user",
        label: t("users.colUser"),
        headerClassName: "px-3 py-2.5",
        noWrap: true,
        cellClassName: "px-3 py-2.5",
        render: (user) => (
          <div className="flex items-center gap-2.5">
            <UserAvatar name={user.name || user.email} id={user.id} size="sm" />
            <p className="text-sm font-semibold text-foreground">
              {user.name?.trim() || user.email || ""}
            </p>
          </div>
        ),
      },
    ];

    if (visible("email")) {
      cols.push({
        id: "email",
        label: t("users.fieldContactEmail"),
        headerClassName: "px-3 py-2.5",
        cellClassName: "px-3 py-2.5 text-xs text-muted-foreground",
        render: (user) => renderUserWorkColumnValue(user, "email", columnContext),
      });
    }

    if (visible("role")) {
      cols.push({
        id: "role",
        label: t("users.colRole"),
        headerClassName: "px-3 py-2.5",
        cellClassName: "px-3 py-2.5",
        render: (user) => renderUserWorkColumnValue(user, "role", columnContext),
      });
    }

    if (visible("status")) {
      cols.push({
        id: "status",
        label: t("users.colStatus"),
        headerClassName: "px-3 py-2.5",
        cellClassName: "px-3 py-2.5",
        render: (user) => renderUserWorkColumnValue(user, "status", columnContext),
      });
    }

    if (visible("lastLogin")) {
      cols.push({
        id: "lastLogin",
        label: t("users.colLastLogin"),
        headerClassName: "px-3 py-2.5",
        noWrap: true,
        cellClassName: "px-3 py-2.5 text-xs text-muted-foreground",
        render: (user) => renderUserWorkColumnValue(user, "lastLogin", columnContext),
      });
    }

    if (visible("created")) {
      cols.push({
        id: "created",
        label: t("users.colCreated"),
        headerClassName: "px-3 py-2.5",
        noWrap: true,
        cellClassName: "px-3 py-2.5 font-mono text-xs text-muted-foreground",
        render: (user) => renderUserWorkColumnValue(user, "created", columnContext),
      });
    }

    if (visible("twoFactor")) {
      cols.push({
        id: "twoFactor",
        label: t("users.col2fa"),
        headerClassName: "px-3 py-2.5",
        cellClassName: "px-3 py-2.5",
        render: (user) => renderUserWorkColumnValue(user, "twoFactor", columnContext),
      });
    }

    return cols;
  }, [columnContext, t, visible]);

  return (
    <WorkBatchTable
      data={users}
      columns={columns}
      className="table-fixed"
      tableBodyClassName="divide-y divide-border"
      selection={
        canDelete
          ? {
              selectedIds,
              onSelectOne: (id) => onToggleSelect(String(id)),
              onSelectAll: onToggleAll,
              allSelected,
              someSelected,
              selectAllAriaLabel: t("users.selectAll"),
              selectRowAriaLabel: (user) => t("users.selectRow", { name: user.name }),
            }
          : undefined
      }
      columnResize={{
        getColumnWidth: (key) => getColumnWidth?.(key),
        onColumnResize,
      }}
      renderRowActions={(user) => (
        <UsersRowActions
          user={user}
          canWrite={canWrite}
          canDelete={canDelete}
          showDeleted={showDeleted}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
          onRestore={onRestore}
          onResetPassword={onResetPassword}
        />
      )}
      actionsLabel={t("users.colActions")}
    />
  );
}
