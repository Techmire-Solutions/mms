import type { CustomWidget } from "./pinnedWidgetTypes";
import {
  DEFAULT_WIDGET_TITLE_KEYS,
  DEFAULT_WIDGET_SUBTEXT_KEYS,
  isSeededDashboardWidget,
} from "@/lib/dashboardWidgets";
import { contactsWidgetSeeds } from "./widgetSeedsContacts";
import { studentsWidgetSeeds } from "./widgetSeedsStudents";
import { financialWidgetSeeds } from "./widgetSeedsFinancial";
import { hasanatWidgetSeeds } from "./widgetSeedsHasanat";
import { sessionsWidgetSeeds } from "./widgetSeedsSessions";

function withDefaultTitleKey(widget: CustomWidget): CustomWidget {
  const titleKey = widget.titleKey ?? DEFAULT_WIDGET_TITLE_KEYS[widget.id];
  if (!titleKey) return widget;
  // Seeded widgets: titleKey is SSOT; drop redundant English title copies.
  if (isSeededDashboardWidget(widget.id)) {
    return { ...widget, titleKey, title: "" };
  }
  return { ...widget, titleKey };
}

function withDefaultSubTextKey(widget: CustomWidget): CustomWidget {
  const fixedSubTextKey = widget.fixedSubTextKey ?? DEFAULT_WIDGET_SUBTEXT_KEYS[widget.id];
  if (!fixedSubTextKey) return widget;
  if (isSeededDashboardWidget(widget.id)) {
    return { ...widget, fixedSubTextKey, fixedSubText: undefined };
  }
  return { ...widget, fixedSubTextKey };
}

export function withDefaultI18nKeys(widget: CustomWidget): CustomWidget {
  return withDefaultSubTextKey(withDefaultTitleKey(widget));
}

export function getDefaultCustomWidgets(category: string): CustomWidget[] {
  const defaults: Record<string, CustomWidget[]> = {
    contacts: contactsWidgetSeeds,
    students: studentsWidgetSeeds,
    financial: financialWidgetSeeds,
    hasanat: hasanatWidgetSeeds,
    sessions: sessionsWidgetSeeds,
  };

  return defaults[category] || [];
}
