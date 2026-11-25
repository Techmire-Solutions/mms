import type { LucideIcon } from "lucide-react";
import type { AppTranslationKey } from "@mms/contracts";

export type ClassDetailTabId =
  "general" | "sections" | "fees" | "schedule" | "budget" | "scholarship";

export interface ClassDetailTabItem {
  id: ClassDetailTabId;
  labelKey: AppTranslationKey;
  icon: LucideIcon;
}
