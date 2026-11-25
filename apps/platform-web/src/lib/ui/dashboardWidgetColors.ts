import { COLOR_MAP, ICONS_LIST as ICONS } from "@/lib/reports/pinnedWidgetTypes";
import { DollarSign } from "lucide-react";
import type { QuickActionColor } from "@/lib/dashboardQuickActions";
import type React from "react";

export type WidgetCardAccent = "primary" | "success" | "warning" | "destructive" | "info";

/** Map widget/quick-action color tokens → WidgetCard / StatCard accents. */
export const WIDGET_COLOR_TO_ACCENT: Record<string, WidgetCardAccent> = {
  emerald: "success",
  blue: "info",
  violet: "primary",
  amber: "warning",
  red: "destructive",
  slate: "primary",
};

export function widgetColorToAccent(color: string | undefined): WidgetCardAccent {
  return WIDGET_COLOR_TO_ACCENT[color ?? ""] ?? "primary";
}

export function getWidgetColorTheme(color: string | undefined) {
  return COLOR_MAP[color ?? ""] ?? COLOR_MAP.emerald;
}

/** Resolves icon component by name with fallback. */
export function resolveCardIconComponent(iconName: string | undefined): React.ElementType {
  return (iconName ? ICONS[iconName] : undefined) || DollarSign;
}

/** Icon chip classes for quick actions — derived from COLOR_MAP (+ slate muted). */
export function getQuickActionIconClasses(color: QuickActionColor): string {
  if (color === "slate") return "bg-muted text-muted-foreground";
  const theme = getWidgetColorTheme(color);
  return `${theme.bg} ${theme.text}`;
}

const QUICK_ACTION_GLOW_CLASSES: Record<QuickActionColor, string> = {
  emerald: "bg-success/15",
  blue: "bg-info/15",
  violet: "bg-primary/15",
  amber: "bg-warning/15",
  slate: "bg-muted-foreground/15",
};

/** Soft glow fill for quick-action hover orbs. */
export function getQuickActionGlowClass(color: QuickActionColor): string {
  return QUICK_ACTION_GLOW_CLASSES[color] ?? QUICK_ACTION_GLOW_CLASSES.emerald;
}

/** Default icon/color fallbacks for KPI cards. */
export const DEFAULT_FALLBACK_CARD_CONFIG = {
  icon: "GraduationCap",
  color: "emerald",
} as const;

export const COLLECTION_DEFAULT_CARD_CONFIG: Partial<
  Record<string, { icon: string; color: string }>
> = {
  contacts: { icon: "Users", color: "blue" },
  students: { icon: "GraduationCap", color: "emerald" },
  faculty: { icon: "School", color: "blue" },
};

export interface CardVisuals {
  icon: string;
  color: string;
  IconComponent: React.ElementType;
  colorTheme: ReturnType<typeof getWidgetColorTheme>;
  accent: WidgetCardAccent;
}

/** Unified SSOT helper to resolve icon, color, theme, and accent with defaults. */
export function resolveCardVisuals(
  widget: { collection?: string; icon?: string; color?: string },
  overrideDefaultConfig?: { icon: string; color: string },
): CardVisuals {
  const defaultConfig =
    overrideDefaultConfig ??
    (widget.collection ? COLLECTION_DEFAULT_CARD_CONFIG[widget.collection] : undefined) ??
    DEFAULT_FALLBACK_CARD_CONFIG;

  const icon = widget.icon || defaultConfig.icon;
  const color = widget.color || defaultConfig.color;

  return {
    icon,
    color,
    IconComponent: resolveCardIconComponent(icon),
    colorTheme: getWidgetColorTheme(color),
    accent: widgetColorToAccent(color),
  };
}
