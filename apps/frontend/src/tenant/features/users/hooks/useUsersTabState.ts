import { useEffect, useRef } from "react";
import type { AppTranslationKey } from "@mms/shared";
import { resolveModuleTierTab } from "@mms/shared";
import { useFilteredModuleTierTabs } from "@/tenant/hooks/useModuleTierTabs";
import { usePersistedTabState } from "@/hooks/usePersistedTabState";
import {
  getUsersConfigTabs,
  getUsersSubTabs,
} from "@/tenant/features/users/hooks/usersPageTabConfig";

export interface UseUsersTabStateOptions {
  canAccessRoles: boolean;
  canViewSetup: boolean;
  canViewReports: boolean;
  onResetSelection?: () => void;
  t: (key: AppTranslationKey) => string;
}

export function useUsersTabState({
  canAccessRoles,
  canViewSetup,
  canViewReports,
  onResetSelection,
  t,
}: UseUsersTabStateOptions) {
  const onResetSelectionRef = useRef(onResetSelection);
  onResetSelectionRef.current = onResetSelection;

  const USERS_CONFIG_TABS = getUsersConfigTabs(canAccessRoles, t);
  const SUB_TABS = getUsersSubTabs(t);
  const [activeTab, setActiveTab] = usePersistedTabState<string>("users_active_tab", "work");
  const [activeSubTab, setActiveSubTab] = usePersistedTabState<string>("users_ops_subtab", "users");
  const [configSubTab, setConfigSubTab] = usePersistedTabState<string>(
    "users_config_subtab",
    "permissions",
  );

  useEffect(() => {
    if ((!canViewSetup && activeTab === "setup") || (!canViewReports && activeTab === "reports")) {
      setActiveTab("work");
    }
  }, [canViewSetup, canViewReports, activeTab, setActiveTab]);

  useEffect(() => {
    onResetSelectionRef.current?.();
  }, [activeTab, activeSubTab]);

  const visibleTopTabs = useFilteredModuleTierTabs({
    canViewSetup,
    canViewReports,
    workLabelKey: "nav.users",
  });

  const effectiveTab = resolveModuleTierTab(
    activeTab,
    visibleTopTabs.map((tab) => tab.id),
  );
  const effectiveSubTab = SUB_TABS.find((tab) => tab.id === activeSubTab) ? activeSubTab : "users";
  const effectiveConfigTab =
    USERS_CONFIG_TABS.find((tab) => tab.id === configSubTab)?.id ??
    USERS_CONFIG_TABS[0]?.id ??
    "preferences";

  return {
    USERS_CONFIG_TABS,
    SUB_TABS,
    activeTab,
    setActiveTab,
    activeSubTab,
    setActiveSubTab,
    configSubTab,
    setConfigSubTab,
    visibleTopTabs,
    effectiveTab,
    effectiveSubTab,
    effectiveConfigTab,
  };
}
