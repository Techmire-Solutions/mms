import { GraduationCap, DollarSign, ClipboardCheck } from "lucide-react";
import { ROUTES } from "@mms/fe-core/config/routes";
import type { CommandItem } from "./systemCommandItems";

/**
 * Deep-link command items for specific module tiers (P3-5).
 * Routes append ?tab=reports or ?tab=setup so the shell pre-selects the tier.
 */
export const MODULE_TIER_COMMAND_ITEMS: CommandItem[] = [
  {
    id: "students-setup",
    labelKey: "nav.students",
    categoryKey: "nav.modules",
    path: `${ROUTES.students}?tab=setup`,
    icon: GraduationCap,
    keywords: ["students setup", "fields", "custom fields", "student configuration"],
  },
  {
    id: "finance-reports",
    labelKey: "nav.finance",
    categoryKey: "nav.modules",
    path: `${ROUTES.finance}?tab=reports`,
    icon: DollarSign,
    keywords: ["finance reports", "fee analytics", "revenue report"],
  },
  {
    id: "attendance-reports",
    labelKey: "nav.attendance",
    categoryKey: "nav.modules",
    path: `${ROUTES.attendance}?tab=reports`,
    icon: ClipboardCheck,
    keywords: ["attendance reports", "absence analytics", "rollcall report"],
  },
];
