import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export interface AccordionTabItem {
  id: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  /** When set, triggers use React Router Link (e.g. settings sections). */
  href?: string;
}

export interface ResponsiveAccordionTabsProps {
  tabs: readonly AccordionTabItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  children: ReactNode;
  isDirty?: boolean;
  onSave?: () => void | Promise<void | boolean>;
  desktopLayout?: "horizontal" | "sidebar";
  hideWhenSingle?: boolean;
  collapsible?: boolean;
  panelIdPrefix?: string;
  className?: string;
}
