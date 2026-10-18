import React from "react";
import { BookOpen, Check, X } from "lucide-react";
import {
  PERMISSION_ACTIONS,
  type PermissionAction,
  type PermissionMap,
  type RbacModuleDef,
  type RbacPermissionMatrixGroup,
} from "@mms/shared";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { PermissionMatrixMobileRow } from "@/tenant/features/users/components/PermissionMatrixMobileRow";

export interface PermissionMatrixMobileListProps {
  groups: readonly RbacPermissionMatrixGroup[];
  perms: PermissionMap;
  readOnly: boolean;
  onToggle: (moduleId: string, action: PermissionAction) => void;
  onSelectAll: (moduleId: string) => void;
  onClearAll: (moduleId: string) => void;
}

export function PermissionMatrixMobileList({
  groups,
  perms,
  readOnly,
  onToggle,
  onSelectAll,
  onClearAll,
}: PermissionMatrixMobileListProps): React.JSX.Element {
  const { t } = useTranslation();

  const isGroupAllChecked = (groupModules: readonly RbacModuleDef[]) => {
    return (
      groupModules.length > 0 &&
      groupModules.every((m) => {
        const actions = perms[m.id] || [];
        return PERMISSION_ACTIONS.every((a) => actions.includes(a));
      })
    );
  };

  const handleToggleGroup = (groupModules: readonly RbacModuleDef[]) => {
    const allChecked = isGroupAllChecked(groupModules);
    for (const m of groupModules) {
      if (allChecked) {
        onClearAll(m.id);
      } else {
        onSelectAll(m.id);
      }
    }
  };

  const matrixActions = { perms, readOnly, onToggle, onSelectAll, onClearAll };

  return (
    <div className="space-y-4 p-3">
      {groups.map((group) => {
        const groupChecked = isGroupAllChecked(group.modules);
        return (
          <section key={group.groupId} className="space-y-2">
            {group.labelKey ? (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                    <BookOpen className="h-3.5 w-3.5 text-primary" aria-hidden />
                  </div>
                  <h3 className="text-xs font-bold text-foreground">{t(group.labelKey)}</h3>
                </div>
                {!readOnly && group.modules.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleGroup(group.modules)}
                    className="h-7 px-2 text-2xs font-semibold text-primary hover:bg-primary/10 gap-1 rounded-md"
                  >
                    {groupChecked ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                    <span>
                      {groupChecked ? t("common.deselect") : t("users.permissions.colAll")}
                    </span>
                  </Button>
                ) : null}
              </div>
            ) : null}
            {group.modules.map((moduleItem: RbacModuleDef) => (
              <PermissionMatrixMobileRow key={moduleItem.id} mod={moduleItem} {...matrixActions} />
            ))}
          </section>
        );
      })}
    </div>
  );
}
