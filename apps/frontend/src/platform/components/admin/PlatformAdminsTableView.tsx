import React from "react";
import { Mail } from "lucide-react";
import type { PlatformUserProfile } from "@mms/shared";
import { formatDate } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { WorkBatchTable, type WorkBatchTableColumn } from "@/components/common/work/WorkBatchTable";
import {
  deriveSelectionState,
  WORK_TABLE_CONTAINER_CLASS,
} from "@/components/common/work/workBatchTableTypes";
import {
  PlatformAdminStatusBadges,
  PlatformAdminPermissionsBadges,
} from "@/platform/components/admin/PlatformAdminBadges";
import { PlatformAdminActionButtons } from "@/platform/components/admin/PlatformAdminActionButtons";
import type { usePlatformUserDescriptor } from "@/platform/hooks/usePlatformUserDescriptor";
import { toColumnResize, type DataTableColumnLayout } from "@/components/common/data-table";
import { resolveVisibleDescriptorColumns } from "@/hooks/useDescriptorColumnLayout";

export type DangerMode = "disable" | "enable" | "delete";

export interface PlatformAdminsTableViewProps {
  admins: PlatformUserProfile[];
  descriptor: ReturnType<typeof usePlatformUserDescriptor>;
  columnLayout?: DataTableColumnLayout;
  onInspect: (admin: PlatformUserProfile) => void;
  onEditAccess: (admin: PlatformUserProfile) => void;
  onToggleStatus: (admin: PlatformUserProfile, mode: DangerMode) => void;
  onDelete: (admin: PlatformUserProfile) => void;
  verifyPending: boolean;
  onVerifyEmail: (adminId: string) => void;
  selectedIds?: ReadonlySet<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
}

export function PlatformAdminsTableView({
  admins,
  descriptor,
  columnLayout,
  onInspect,
  onEditAccess,
  onToggleStatus,
  onDelete,
  verifyPending,
  onVerifyEmail,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
}: PlatformAdminsTableViewProps): React.JSX.Element {
  const { t } = useTranslation();

  const selection = React.useMemo(() => {
    if (!selectedIds || !onToggleSelect || !onToggleSelectAll) return undefined;
    return {
      selectedIds,
      onSelectOne: onToggleSelect,
      onSelectAll: onToggleSelectAll,
      ...deriveSelectionState(admins, selectedIds),
    };
  }, [admins, selectedIds, onToggleSelect, onToggleSelectAll]);

  const columns: WorkBatchTableColumn<PlatformUserProfile>[] = React.useMemo(() => {
    return resolveVisibleDescriptorColumns(
      descriptor.getTableColumns(),
      columnLayout?.columnRegistry,
    ).map((col) => {
      if (col.id === "name") {
        return {
          id: "name",
          label: col.label,
          sortField: "name",
          headerClassName: "min-w-64 flex-1",
          cellClassName: "px-4 py-3 align-top min-w-64",
          render: (admin: PlatformUserProfile) => (
            <div className="space-y-1">
              <p className="font-bold text-foreground">{admin.name}</p>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Mail className="w-3.5 h-3.5" aria-hidden />
                <span dir="ltr">{admin.email}</span>
              </div>
              {admin.createdAt ? (
                <p className="text-2xs text-muted-foreground font-semibold mt-1">
                  {t("platform.profileMemberSince")}: {formatDate(admin.createdAt)}
                </p>
              ) : null}
            </div>
          ),
        };
      }
      if (col.id === "status") {
        return {
          id: "status",
          label: col.label,
          headerClassName: "w-40 min-w-40",
          cellClassName: "px-4 py-3 align-top w-40 min-w-40",
          render: (admin: PlatformUserProfile) => <PlatformAdminStatusBadges admin={admin} />,
        };
      }
      return {
        id: col.id,
        label: col.label,
        headerClassName: "w-48 min-w-48",
        cellClassName: "px-4 py-3 align-top w-48 min-w-48",
        render: (admin: PlatformUserProfile) => <PlatformAdminPermissionsBadges admin={admin} />,
      };
    });
  }, [descriptor, columnLayout, t]);

  return (
    <WorkBatchTable
      data={admins}
      columns={columns}
      onRowClick={onInspect}
      selection={selection}
      actionsLabel={t("common.actions")}
      actionsHeaderClassName="w-56 min-w-56 text-end px-4 py-3"
      actionsCellClassName="w-56 min-w-56 text-end px-4 py-3 align-top"
      renderRowActions={(admin) => (
        <PlatformAdminActionButtons
          admin={admin}
          onEditAccess={onEditAccess}
          onToggleStatus={onToggleStatus}
          onDelete={onDelete}
          verifyPending={verifyPending}
          onVerifyEmail={onVerifyEmail}
        />
      )}
      rowClassName={() =>
        "group hover:bg-muted/30 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-inset"
      }
      columnResize={toColumnResize(columnLayout)}
      containerClassName={WORK_TABLE_CONTAINER_CLASS}
    />
  );
}
