import React from "react";
import type { PlatformUserProfile } from "@mms/shared";
import { formatDate } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { EntityCardsGrid } from "@/components/ui/EntityCardsGrid";
import { DirectoryCard } from "@/components/ui/DirectoryCard";
import { EntityCardMetadata } from "@/components/ui/EntityCardMetadata";
import {
  PlatformAdminStatusBadges,
  PlatformAdminPermissionsBadges,
} from "@/platform/components/admin/PlatformAdminBadges";
import { PlatformAdminActionButtons } from "@/platform/components/admin/PlatformAdminActionButtons";
import { Checkbox } from "@/components/ui/checkbox";
import type { EntityDescriptor } from "@/types/entityRegistry";

export interface PlatformAdminsListCardsProps {
  admins: PlatformUserProfile[];
  descriptor: EntityDescriptor<PlatformUserProfile>;
  onInspect: (admin: PlatformUserProfile) => void;
  onEditAccess: (admin: PlatformUserProfile) => void;
  onToggleStatus: (admin: PlatformUserProfile, mode: "disable" | "enable") => void;
  onDelete: (admin: PlatformUserProfile) => void;
  verifyPending?: boolean;
  onVerifyEmail?: (adminId: string) => void;
  selectedIds?: ReadonlySet<string>;
  onToggleSelect?: (id: string) => void;
}

/**
 * Directory cards view for Platform Administrators, aligning with MMS [Entity]ListCards conventions.
 */
export function PlatformAdminsListCards({
  admins,
  descriptor,
  onInspect,
  onEditAccess,
  onToggleStatus,
  onDelete,
  verifyPending = false,
  onVerifyEmail,
  selectedIds,
  onToggleSelect,
}: PlatformAdminsListCardsProps): React.JSX.Element {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();

  return (
    <EntityCardsGrid>
      {admins.map((admin) => (
        <DirectoryCard
          key={admin.id}
          entity={admin}
          reducedMotion={reducedMotion}
          accentClassName={
            admin.role === "super_user"
              ? "bg-primary/80 group-hover:bg-primary"
              : "bg-primary/50 group-hover:bg-primary"
          }
          className="flex flex-col justify-between cursor-pointer"
          onView={onInspect}
          headerSlot={
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {onToggleSelect && selectedIds && (
                  <Checkbox
                    checked={selectedIds.has(admin.id)}
                    onCheckedChange={() => onToggleSelect(admin.id)}
                    aria-label={admin.name}
                    className="shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
                <p className="min-w-0 truncate text-sm font-bold text-foreground">{admin.name}</p>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                <PlatformAdminStatusBadges admin={admin} />
              </div>
            </div>
          }
          metadataSlot={
            <EntityCardMetadata
              descriptor={descriptor}
              entity={admin}
              visibleColumnIds={["email"]}
            />
          }
          footer={
            <div
              className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40 mt-3 w-full"
              onClick={(e) => e.stopPropagation()}
            >
              {admin.createdAt ? (
                <p className="text-xs text-muted-foreground font-semibold">
                  {t("platform.profileMemberSince")}: {formatDate(admin.createdAt)}
                </p>
              ) : (
                <span />
              )}
              <PlatformAdminActionButtons
                admin={admin}
                onEditAccess={onEditAccess}
                onToggleStatus={onToggleStatus}
                onDelete={onDelete}
                verifyPending={verifyPending}
                onVerifyEmail={onVerifyEmail}
              />
            </div>
          }
        >
          <PlatformAdminPermissionsBadges admin={admin} />
        </DirectoryCard>
      ))}
    </EntityCardsGrid>
  );
}
