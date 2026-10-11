import type { JSX } from "react";
import { Eye, KeyRound, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { canManageTargetUser, type SystemUser } from "@mms/shared";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { useOptionalAuth } from "@/lib/contexts/AuthContext";

interface UsersRowActionsProps {
  user: SystemUser;
  canWrite: boolean;
  canDelete: boolean;
  showDeleted: boolean;
  /** When true, omit View (card already exposes a View control). */
  hideViewItem?: boolean;
  onView: (user: SystemUser) => void;
  onEdit: (user: SystemUser) => void;
  onDelete: (id: string) => void;
  onRestore: (id: string) => void;
  onResetPassword: (user: SystemUser) => void;
}

export function UsersRowActions({
  user,
  canWrite,
  canDelete,
  showDeleted,
  hideViewItem = false,
  onView,
  onEdit,
  onDelete,
  onRestore,
  onResetPassword,
}: UsersRowActionsProps): JSX.Element {
  const { t } = useTranslation();
  const auth = useOptionalAuth();
  const authUser = auth?.user;

  const isSelf = authUser ? String(user.id) === String(authUser.id) : false;
  const canManageTarget = authUser ? canManageTargetUser(authUser.role, user.role) : true;
  const canMutateTarget = canWrite && canManageTarget;
  const canDeleteTarget = canDelete && !isSelf && canManageTarget;
  const canRestoreTarget = canDelete && canManageTarget;

  return (
    <div className="flex items-center justify-end gap-1">
      {!hideViewItem && (
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={() => onView(user)}
          className="min-h-11 min-w-11 rounded-lg border-border/50 bg-background/50 hover:bg-muted text-muted-foreground hover:text-foreground shadow-none"
          aria-label={t("users.actionView", { name: user.name })}
        >
          <Eye className="h-4 w-4" />
        </Button>
      )}
      {canMutateTarget && !showDeleted && (
        <>
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => onEdit(user)}
            className="min-h-11 min-w-11 rounded-lg border-info/30 bg-info/5 text-info hover:text-info hover:bg-info/15 hover:border-info/40 shadow-none"
            aria-label={t("users.actionEdit", { name: user.name })}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => onResetPassword(user)}
            className="min-h-11 min-w-11 rounded-lg border-primary/30 bg-primary/5 text-primary hover:text-primary hover:bg-primary/15 hover:border-primary/40 shadow-none"
            aria-label={t("users.actionResetPassword", { name: user.name })}
          >
            <KeyRound className="h-4 w-4" />
          </Button>
        </>
      )}
      {((showDeleted && canRestoreTarget) || (!showDeleted && canDeleteTarget)) && (
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={() => (showDeleted ? onRestore(user.id) : onDelete(user.id))}
          className={
            showDeleted
              ? "min-h-11 min-w-11 rounded-lg border-success/30 bg-success/5 text-success hover:text-success hover:bg-success/15 hover:border-success/40 shadow-none"
              : "min-h-11 min-w-11 rounded-lg border-destructive/30 bg-destructive/5 text-destructive hover:text-destructive hover:bg-destructive/15 hover:border-destructive/40 shadow-none"
          }
          aria-label={
            showDeleted ? t("users.trash.restore") : t("users.trash.delete", { name: user.name })
          }
        >
          {showDeleted ? (
            <RotateCcw className="h-4 w-4" aria-hidden />
          ) : (
            <Trash2 className="h-4 w-4" aria-hidden />
          )}
        </Button>
      )}
    </div>
  );
}
