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
import { ModuleTableHeaderCell } from "@/components/app/ModuleTableHeaderCell";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { useTranslation } from "@/hooks/useTranslation";
import { PermissionMatrixRow } from "@/tenant/features/users/components/PermissionMatrixRow";

export interface PermissionMatrixDesktopTableProps {
  groups: readonly RbacPermissionMatrixGroup[];
  filteredModules: readonly RbacModuleDef[];
  perms: PermissionMap;
  readOnly: boolean;
  allModulesChecked: boolean;
  colSpan: number;
  onToggle: (moduleId: string, action: PermissionAction) => void;
  onSelectAll: (moduleId: string) => void;
  onClearAll: (moduleId: string) => void;
  onToggleGlobalAll: () => void;
}

export function PermissionMatrixDesktopTable({
  groups,
  filteredModules,
  perms,
  readOnly,
  allModulesChecked,
  colSpan,
  onToggle,
  onSelectAll,
  onClearAll,
  onToggleGlobalAll,
}: PermissionMatrixDesktopTableProps): React.JSX.Element {
  const { t } = useTranslation();

  const isColumnAllChecked = (action: PermissionAction) => {
    return (
      filteredModules.length > 0 &&
      filteredModules.every((m) => (perms[m.id] || []).includes(action))
    );
  };

  const handleToggleColumn = (action: PermissionAction) => {
    const colChecked = isColumnAllChecked(action);
    for (const m of filteredModules) {
      const current = perms[m.id] || [];
      const hasAction = current.includes(action);
      if (colChecked && hasAction) {
        onToggle(m.id, action);
      } else if (!colChecked && !hasAction) {
        onToggle(m.id, action);
      }
    }
  };

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
    <div>
      <Table>
        <caption className="sr-only">{t("users.permissions.matrixCaption")}</caption>
        <TableHeader>
          <TableRow className="border-b border-border bg-muted/30 hover:bg-muted/30">
            <ModuleTableHeaderCell columnKey="module" className="min-w-input-filter px-3 py-2.5">
              <span>{t("users.permissions.colModule")}</span>
            </ModuleTableHeaderCell>
            {PERMISSION_ACTIONS.map((permissionAction) => (
              <ModuleTableHeaderCell
                key={permissionAction}
                columnKey={permissionAction}
                variant="action"
                noWrap
                className="w-16 px-1 py-1.5"
              >
                {!readOnly ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleColumn(permissionAction)}
                    className="h-7 touch-target-coarse w-full px-1 text-2xs font-semibold hover:bg-primary/10 gap-0.5 rounded-md cursor-pointer justify-center"
                    title={t(`users.permission.${permissionAction}`)}
                  >
                    <span>{t(`users.permission.${permissionAction}`)}</span>
                  </Button>
                ) : (
                  <span>{t(`users.permission.${permissionAction}`)}</span>
                )}
              </ModuleTableHeaderCell>
            ))}
            {!readOnly ? (
              <ModuleTableHeaderCell
                columnKey="all"
                variant="action"
                noWrap
                className="px-2 py-2.5"
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onToggleGlobalAll}
                  className="h-7 touch-target-coarse px-2 text-2xs font-bold text-primary hover:bg-primary/10 gap-1 rounded-md cursor-pointer"
                  aria-label={
                    allModulesChecked ? t("common.deselect") : t("users.permissions.colAll")
                  }
                  title={t("users.permissions.colAll")}
                >
                  {allModulesChecked ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                  <span>{t("users.permissions.colAll")}</span>
                </Button>
              </ModuleTableHeaderCell>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-border">
          {groups.map((group) => {
            const groupChecked = isGroupAllChecked(group.modules);
            return (
              <React.Fragment key={group.groupId}>
                {group.labelKey ? (
                  <TableRow className="bg-muted/25">
                    <TableCell colSpan={colSpan} className="px-3 py-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
                            <BookOpen className="h-3 w-3 text-primary" aria-hidden />
                          </div>
                          <span className="text-xs font-bold text-foreground">
                            {t(group.labelKey)}
                          </span>
                        </div>
                        {!readOnly && group.modules.length > 1 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleGroup(group.modules)}
                            className="h-6 touch-target-coarse px-2 text-2xs font-medium text-primary hover:bg-primary/10 gap-1 rounded-md"
                          >
                            {groupChecked ? (
                              <X className="h-3 w-3" />
                            ) : (
                              <Check className="h-3 w-3" />
                            )}
                            <span>
                              {groupChecked ? t("common.deselect") : t("users.permissions.colAll")}
                            </span>
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
                {group.modules.map((moduleItem: RbacModuleDef) => (
                  <PermissionMatrixRow
                    key={moduleItem.id}
                    mod={moduleItem}
                    inGroup={!!group.labelKey}
                    {...matrixActions}
                  />
                ))}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
