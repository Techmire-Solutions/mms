import React, { useDeferredValue, useMemo, useState } from "react";
import {
  groupRbacModulesForPermissionsNav,
  PERMISSION_ACTIONS,
  type PermissionAction,
  type PermissionMap,
  type RbacModuleDef,
} from "@mms/shared";
import { WORK_SURFACE } from "@/components/ui/formStyles";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTranslation } from "@/hooks/useTranslation";
import {
  useWorkDirectoryViewMode,
  type WorkDirectoryViewMode,
} from "@/hooks/useWorkDirectoryViewMode";
import { PermissionMatrixToolbar } from "@/tenant/features/users/components/PermissionMatrixToolbar";
import { PermissionMatrixMobileList } from "@/tenant/features/users/components/PermissionMatrixMobileList";
import { PermissionMatrixDesktopTable } from "@/tenant/features/users/components/PermissionMatrixDesktopTable";

interface PermissionMatrixProps {
  modules: readonly RbacModuleDef[];
  perms: PermissionMap;
  readOnly: boolean;
  onToggle: (moduleId: string, action: PermissionAction) => void;
  onSelectAll: (moduleId: string) => void;
  onClearAll: (moduleId: string) => void;
  viewMode?: WorkDirectoryViewMode;
}

export function PermissionMatrix({
  modules,
  perms,
  readOnly,
  onToggle,
  onSelectAll,
  onClearAll,
  viewMode: propViewMode,
}: PermissionMatrixProps): React.JSX.Element {
  const { t } = useTranslation();
  const { viewMode: hookViewMode } = useWorkDirectoryViewMode();
  const viewMode = propViewMode ?? hookViewMode;
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);

  const filteredModules = useMemo(() => {
    if (!deferredSearch.trim()) return modules;
    const q = deferredSearch.trim().toLowerCase();
    return modules.filter(
      (m) => t(m.labelKey).toLowerCase().includes(q) || m.id.toLowerCase().includes(q),
    );
  }, [modules, deferredSearch, t]);

  const groups = useMemo(
    () => groupRbacModulesForPermissionsNav(filteredModules),
    [filteredModules],
  );
  const colSpan = PERMISSION_ACTIONS.length + 1 + (readOnly ? 0 : 1);
  const matrixActions = { perms, readOnly, onToggle, onSelectAll, onClearAll };

  const totalPossible = modules.length * PERMISSION_ACTIONS.length;
  const totalGranted = useMemo(() => {
    return modules.reduce((count, m) => count + (perms[m.id]?.length ?? 0), 0);
  }, [modules, perms]);

  const allModulesChecked = useMemo(() => {
    return (
      filteredModules.length > 0 &&
      filteredModules.every((m) => {
        const actions = perms[m.id] || [];
        return PERMISSION_ACTIONS.every((a) => actions.includes(a));
      })
    );
  }, [filteredModules, perms]);

  const handleToggleGlobalAll = () => {
    if (allModulesChecked) {
      for (const m of filteredModules) onClearAll(m.id);
    } else {
      for (const m of filteredModules) onSelectAll(m.id);
    }
  };

  if (modules.length === 0) {
    return (
      <div className={WORK_SURFACE}>
        <EmptyState title={t("users.permissions.emptyRoles")} compact />
      </div>
    );
  }

  return (
    <div className={WORK_SURFACE}>
      <PermissionMatrixToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        totalGranted={totalGranted}
        totalPossible={totalPossible}
        readOnly={readOnly}
        hasFilteredModules={filteredModules.length > 0}
        allModulesChecked={allModulesChecked}
        onToggleGlobalAll={handleToggleGlobalAll}
      />

      {filteredModules.length === 0 ? (
        <div className="p-6">
          <EmptyState
            title={t("common.columns.noMatches")}
            description={t("common.clearFilters")}
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSearchQuery("")}
                className="mt-2 text-xs"
              >
                {t("common.clearSearch")}
              </Button>
            }
            compact
          />
        </div>
      ) : viewMode === "cards" ? (
        <PermissionMatrixMobileList groups={groups} {...matrixActions} />
      ) : (
        <PermissionMatrixDesktopTable
          groups={groups}
          filteredModules={filteredModules}
          perms={perms}
          readOnly={readOnly}
          allModulesChecked={allModulesChecked}
          colSpan={colSpan}
          onToggle={onToggle}
          onSelectAll={onSelectAll}
          onClearAll={onClearAll}
          onToggleGlobalAll={handleToggleGlobalAll}
        />
      )}
    </div>
  );
}

export { PermissionMatrixRow } from "@/tenant/features/users/components/PermissionMatrixRow";
export { PermissionMatrixMobileRow } from "@/tenant/features/users/components/PermissionMatrixMobileRow";
export { PermissionMatrixToolbar } from "@/tenant/features/users/components/PermissionMatrixToolbar";
export { PermissionMatrixMobileList } from "@/tenant/features/users/components/PermissionMatrixMobileList";
export { PermissionMatrixDesktopTable } from "@/tenant/features/users/components/PermissionMatrixDesktopTable";
