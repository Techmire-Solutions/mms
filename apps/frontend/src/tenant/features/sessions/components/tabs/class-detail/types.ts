import type { LucideIcon } from "lucide-react";
import type { AppTranslationKey } from "@mms/shared";

export type ClassDetailTabId = "general" | "fees" | "schedule" | "budget" | "scholarship";

export interface ClassDetailTabItem {
  id: ClassDetailTabId;
  labelKey: AppTranslationKey;
  icon: LucideIcon;
}
