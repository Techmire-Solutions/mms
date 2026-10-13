import { GraduationCap, DollarSign, ClipboardCheck } from "lucide-react";
import type { AppTranslationKey } from "@mms/shared";
import { ROUTES } from "@/lib/config/routes";
import type { CommandItem } from "@/components/ui/systemCommandItems";

/**
 * Deep-link command items for specific module tiers (P3-5).
 * Routes append ?tab=reports or ?tab=setup so the shell pre-selects the tier.
 */
export const MODULE_TIER_COMMAND_ITEMS: CommandItem[] = [
  {
    id: "students-setup",
    labelKey: "nav.students" as AppTranslationKey,
    fallbackLabel: "Students → Setup Fields",
    categoryKey: "nav.modules",
    fallbackCategory: "Setup",
    path: `${ROUTES.students}?tab=setup`,
    icon: GraduationCap,
    keywords: ["students setup", "fields", "custom fields", "student configuration"],
  },
  {
    id: "finance-reports",
    labelKey: "nav.finance" as AppTranslationKey,
    fallbackLabel: "Finance → Reports",
    categoryKey: "nav.modules",
    fallbackCategory: "Reports",
    path: `${ROUTES.finance}?tab=reports`,
    icon: DollarSign,
    keywords: ["finance reports", "fee analytics", "revenue report"],
  },
  {
    id: "attendance-reports",
    labelKey: "nav.attendance" as AppTranslationKey,
    fallbackLabel: "Attendance → Reports",
    categoryKey: "nav.modules",
    fallbackCategory: "Reports",
    path: `${ROUTES.attendance}?tab=reports`,
    icon: ClipboardCheck,
    keywords: ["attendance reports", "absence analytics", "rollcall report"],
  },
];
