import React from "react";
import { Check, X } from "lucide-react";
import {
  PERMISSION_ACTIONS,
  type PermissionAction,
  type PermissionMap,
  type RbacModuleDef,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { PermCell } from "@/tenant/features/users/components/RolesPermCell";

export interface PermissionMatrixActions {
  perms: PermissionMap;
  readOnly: boolean;
  onToggle: (moduleId: string, action: PermissionAction) => void;
  onSelectAll: (moduleId: string) => void;
  onClearAll: (moduleId: string) => void;
}

export interface PermissionMatrixRowProps extends PermissionMatrixActions {
  mod: RbacModuleDef;
  inGroup: boolean;
}

export function PermissionMatrixRow({
  mod,
  perms,
  readOnly,
  inGroup,
  onToggle,
  onSelectAll,
  onClearAll,
}: PermissionMatrixRowProps): React.JSX.Element {
  const { t } = useTranslation();
  const currentActions = perms[mod.id] || [];
  const allChecked = PERMISSION_ACTIONS.every((permissionAction) =>
    currentActions.includes(permissionAction),
  );
  const hasAny = currentActions.length > 0;

  return (
    <TableRow
      className={`transition-colors ${
        allChecked
          ? "bg-primary/[0.02] hover:bg-primary/[0.05]"
          : hasAny || !readOnly
            ? "hover:bg-muted/20"
            : "opacity-40"
      }`}
    >
      <TableCell
        className={`px-3 py-2.5 text-xs font-semibold text-foreground ${inGroup ? "ps-8" : ""}`}
      >
        <div className="flex items-center justify-between gap-2 pe-1">
          <span className="truncate">{t(mod.labelKey)}</span>
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-2xs font-semibold ${
              allChecked
                ? "bg-primary/15 text-primary"
                : hasAny
                  ? "bg-muted text-foreground"
                  : "bg-muted/40 text-muted-foreground"
            }`}
          >
            {currentActions.length}/{PERMISSION_ACTIONS.length}
          </span>
        </div>
      </TableCell>
      {PERMISSION_ACTIONS.map((permissionAction) => {
        const isActionActive = currentActions.includes(permissionAction);
        return (
          <TableCell key={permissionAction} variant="action" noWrap className="px-2 py-2.5">
            {readOnly ? (
              <div
                role="status"
                aria-label={`${t(mod.labelKey)}: ${t(`users.permission.${permissionAction}`)}: ${
                  isActionActive ? t("common.yes") : t("common.no")
                }`}
                className={`mx-auto flex h-7 w-7 items-center justify-center rounded-lg border-2 transition-colors ${
                  isActionActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-transparent"
                }`}
              >
                <Check className="h-3.5 w-3.5" />
              </div>
            ) : (
              <PermCell
                checked={isActionActive}
                onChange={() => onToggle(mod.id, permissionAction)}
                ariaLabel={`${t(mod.labelKey)}: ${t(`users.permission.${permissionAction}`)}`}
              />
            )}
          </TableCell>
        );
      })}
      {!readOnly ? (
        <TableCell variant="action" noWrap className="px-2 py-2.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => (allChecked ? onClearAll(mod.id) : onSelectAll(mod.id))}
            aria-label={`${t("users.permissions.colAll")}: ${t(mod.labelKey)}`}
            className={`mx-auto flex min-h-11 min-w-11 items-center justify-center rounded-lg border-2 text-xs font-bold transition-all p-0 shadow-none cursor-pointer ${
              allChecked
                ? "border-primary bg-primary/15 text-primary hover:bg-primary/15"
                : "border-primary/30 text-primary/60 hover:bg-primary/10"
            }`}
          >
            {allChecked ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />}
          </Button>
        </TableCell>
      ) : null}
    </TableRow>
  );
}
