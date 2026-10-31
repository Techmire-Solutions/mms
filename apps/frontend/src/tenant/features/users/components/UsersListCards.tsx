import type { SystemUser } from "@mms/shared";
import { DirectoryEntityCard } from "@/components/app/DirectoryEntityCard";
import { ModuleDirectoryCards } from "@/components/app/ModuleDirectoryCards";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDirectoryPageCountLabel } from "@/lib/formatDirectoryPageCountLabel";
import { UserArchivedBanner } from "@/tenant/features/users/components/UserArchivedBanner";
import { UserCardActions } from "@/tenant/features/users/components/UserCardActions";
import { UserCardMetadata } from "@/tenant/features/users/components/UserCardMetadata";

export interface UsersListCardsProps {
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
  isColumnVisible?: (key: string) => boolean;
}

interface UserCardProps {
  user: SystemUser;
  selectedIds: string[];
  canWrite: boolean;
  canDelete: boolean;
  showDeleted: boolean;
  formatLoginDate: (timestamp: string) => string;
  onToggleSelect: (id: string) => void;
  onView: (user: SystemUser) => void;
  onEdit: (user: SystemUser) => void;
  onDelete: (id: string) => void;
  onRestore: (id: string) => void;
  onResetPassword: (user: SystemUser) => void;
  isColumnVisible?: (key: string) => boolean;
  reducedMotion: boolean;
}

function UserCard({
  user,
  selectedIds,
  canWrite,
  canDelete,
  showDeleted,
  formatLoginDate,
  onToggleSelect,
  onView,
  onEdit,
  onDelete,
  onRestore,
  onResetPassword,
  isColumnVisible,
  reducedMotion,
}: UserCardProps): React.JSX.Element {
  const showEmail = !isColumnVisible || isColumnVisible("email");
  const displayName = user.name?.trim() || user.email || "";

  return (
    <DirectoryEntityCard
      entity={user}
      selectedIds={selectedIds}
      canSelect={canDelete}
      onToggleSelected={onToggleSelect}
      onView={onView}
      onEdit={onEdit}
      reducedMotion={reducedMotion}
      accentClassName={
        user.role === "admin"
          ? "bg-primary/80 group-hover:bg-primary"
          : "bg-primary/50 group-hover:bg-primary"
      }
      header={{
        displayName,
        subtitle:
          showEmail && user.email ? (
            <p
              className="mt-0.5 text-xs font-semibold text-muted-foreground truncate"
              title={user.email}
            >
              {user.email}
            </p>
          ) : undefined,
      }}
      banner={<UserArchivedBanner user={user} />}
      metadataSlot={
        <UserCardMetadata
          user={user}
          formatLoginDate={formatLoginDate}
          isColumnVisible={isColumnVisible}
        />
      }
      footer={
        <UserCardActions
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
      }
    />
  );
}

/** Work directory cards for Users — shared directory card chrome. */
export function UsersListCards({
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
}: UsersListCardsProps): React.JSX.Element {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const pageCountLabel = formatDirectoryPageCountLabel(users.length, t, {
    singular: "users.form.user",
    plural: "users.table.users",
  });

  return (
    <ModuleDirectoryCards
      items={users}
      selectedIds={selectedIds}
      onSelectAll={canDelete ? onToggleAll : undefined}
      allSelected={allSelected}
      someSelected={someSelected}
      selectAllLabel={t("users.selectAll")}
      deselectAllLabel={t("common.deselect")}
      selectedCountLabel={t("users.selectedCount", { count: selectedIds.length })}
      pageCountLabel={pageCountLabel}
      checkboxIdPrefix="users-cards"
      renderItem={(user) => (
        <UserCard
          key={user.id}
          user={user}
          selectedIds={selectedIds}
          canWrite={canWrite}
          canDelete={canDelete}
          showDeleted={showDeleted}
          formatLoginDate={formatLoginDate}
          onToggleSelect={onToggleSelect}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
          onRestore={onRestore}
          onResetPassword={onResetPassword}
          isColumnVisible={isColumnVisible}
          reducedMotion={reducedMotion}
        />
      )}
    />
  );
}
