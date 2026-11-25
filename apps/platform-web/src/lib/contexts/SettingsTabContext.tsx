import React, { createContext, useContext } from "react";
import type { SettingsSection } from "@mms/fe-core/config/routes";

export interface SettingsTabContextValue {
  activeTab: SettingsSection;
  setActiveTab: (tab: SettingsSection) => void;
}

const SettingsTabContext = createContext<SettingsTabContextValue | null>(null);

export function SettingsTabProvider({
  value,
  children,
}: {
  value: SettingsTabContextValue;
  children: React.ReactNode;
}): React.JSX.Element {
  return <SettingsTabContext.Provider value={value}>{children}</SettingsTabContext.Provider>;
}

export function useSettingsTab(): SettingsTabContextValue {
  const settingsTab = useContext(SettingsTabContext);
  if (!settingsTab) {
    throw new Error("useSettingsTab must be used within Settings");
  }
  return settingsTab;
}
