import type { SystemUser } from "@mms/shared";
import { DirectoryCardFooterActions } from "@/components/app/DirectoryCardFooterActions";
import { useTranslation } from "@/hooks/useTranslation";
import { UsersRowActions } from "@/tenant/features/users/components/UsersRowActions";

export interface UserCardActionsProps {
  user: SystemUser;
  canWrite: boolean;
  canDelete: boolean;
  showDeleted: boolean;
  onView: (user: SystemUser) => void;
  onEdit: (user: SystemUser) => void;
  onDelete: (id: string) => void;
  onRestore: (id: string) => void;
  onResetPassword: (user: SystemUser) => void;
}

/** Contacts-shaped card footer: View + remaining icon actions. */
export function UserCardActions({
  user,
  canWrite,
  canDelete,
  showDeleted,
  onView,
  onEdit,
  onDelete,
  onRestore,
  onResetPassword,
}: UserCardActionsProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <DirectoryCardFooterActions
      onView={() => onView(user)}
      viewLabel={t("users.actionViewShort")}
      viewAriaLabel={t("users.actionView", { name: user.name })}
      overflowActions={
        <UsersRowActions
          user={user}
          canWrite={canWrite}
          canDelete={canDelete}
          showDeleted={showDeleted}
          hideViewItem
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
