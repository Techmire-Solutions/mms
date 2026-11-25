import React from "react";
import type { PlatformUserProfile } from "@mms/contracts";
import { DetailDrawerShell } from "@/components/app/DetailDrawerShell";
import { EntityDescriptorSections } from "@/components/app/EntityDescriptorSections";
import { PlatformEditAdminAccessDialog } from "@/platform/features/users/components/admin/PlatformEditAdminAccessDialog";
import { PlatformAdminDangerDialog } from "@/platform/features/users/components/admin/PlatformAdminDangerDialog";
import type { DangerMode } from "@/platform/features/users/components/admin/PlatformAdminsTableView";
import type { usePlatformUserDescriptor } from "@/platform/features/users/hooks/usePlatformUserDescriptor";

export interface PlatformAdminsDialogsProps {
  editingAdmin: PlatformUserProfile | null;
  onCloseEditing: () => void;
  dangerAdmin: PlatformUserProfile | null;
  dangerMode: DangerMode;
  onCloseDanger: () => void;
  inspectAdmin: PlatformUserProfile | null;
  onCloseInspect: () => void;
  descriptor: ReturnType<typeof usePlatformUserDescriptor>;
}

export function PlatformAdminsDialogs({
  editingAdmin,
  onCloseEditing,
  dangerAdmin,
  dangerMode,
  onCloseDanger,
  inspectAdmin,
  onCloseInspect,
  descriptor,
}: PlatformAdminsDialogsProps): React.JSX.Element {
  return (
    <>
      {editingAdmin ? (
        <PlatformEditAdminAccessDialog
          admin={editingAdmin}
          open={Boolean(editingAdmin)}
          onOpenChange={(open) => {
            if (!open) onCloseEditing();
          }}
        />
      ) : null}

      {dangerAdmin ? (
        <PlatformAdminDangerDialog
          admin={dangerAdmin}
          mode={dangerMode}
          open={Boolean(dangerAdmin)}
          onOpenChange={(open) => {
            if (!open) onCloseDanger();
          }}
        />
      ) : null}

      <DetailDrawerShell
        open={Boolean(inspectAdmin)}
        onClose={onCloseInspect}
        title={inspectAdmin?.name ?? "Admin"}
      >
        {inspectAdmin ? (
          <EntityDescriptorSections
            entity={inspectAdmin}
            entityType="platformUsers"
            descriptor={descriptor}
          />
        ) : null}
      </DetailDrawerShell>
    </>
  );
}
