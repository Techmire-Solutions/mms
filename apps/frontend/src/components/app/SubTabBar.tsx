import React, { useRef } from "react";
import { useScrollSurfaceOnChange } from "@/lib/routing/useScrollSurfaceOnChange";
import {
  SubTabBarAccordionVariant,
  SubTabBarPillVariant,
  SubTabBarUnderlineVariant,
} from "@/components/app/SubTabBarVariants";

export interface SubTab<K extends string = string> {
  key: K;
  label: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: number | string;
  tone?: "destructive" | "primary" | "muted";
}

export type SubTabBarVariant = "pill" | "underline" | "enclosed";

export interface SubTabBarProps<K extends string> {
  tabs: readonly SubTab<K>[];
  value: K;
  onChange: (key: K) => void;
  variant?: SubTabBarVariant;
  className?: string;
  children?: React.ReactNode;
  panelIdPrefix?: string;
  /**
   * Reset the page surface when the active sub-tab changes.
   * Disable inside drawers/overlays that should not scroll the page behind them.
   */
  resetScrollOnChange?: boolean;
}

/**
 * Responsive sub-tab navigation. Supports modern underline, segmented pill, and accordion modes.
 */
export const SubTabBar = function SubTabBar<K extends string>({
  tabs,
  value,
  onChange,
  variant = "pill",
  className = "",
  children,
  panelIdPrefix = "subtab-panel",
  resetScrollOnChange = true,
}: SubTabBarProps<K>): React.JSX.Element | null {
  const sectionRefs = useRef<Partial<Record<string, HTMLElement | null>>>({});

  useScrollSurfaceOnChange(value, {
    enabled: resetScrollOnChange,
    block: children ? "nearest" : "start",
    resolveMobileTarget: children ? (key) => sectionRefs.current[key] : undefined,
  });

  if (tabs.length <= 1 && !children) {
    return null;
  }

  if (variant === "underline") {
    return (
      <SubTabBarUnderlineVariant
        tabs={tabs}
        value={value}
        onChange={onChange}
        className={className}
        panelIdPrefix={panelIdPrefix}
      >
        {children}
      </SubTabBarUnderlineVariant>
    );
  }

  if (children) {
    return (
      <SubTabBarAccordionVariant
        tabs={tabs}
        value={value}
        onChange={onChange}
        className={className}
        panelIdPrefix={panelIdPrefix}
        sectionRefs={sectionRefs}
      >
        {children}
      </SubTabBarAccordionVariant>
    );
  }

  return (
    <SubTabBarPillVariant
      tabs={tabs}
      value={value}
      onChange={onChange}
      className={className}
      panelIdPrefix={panelIdPrefix}
    />
  );
} as <K extends string>(props: SubTabBarProps<K>) => React.JSX.Element | null;
