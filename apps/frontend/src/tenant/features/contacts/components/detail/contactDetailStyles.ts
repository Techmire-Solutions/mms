import {
  Calendar,
  MessageCircle,
  MessageSquare,
  Phone,
  type LucideIcon,
  LayoutDashboard,
  History,
  FileText,
  Zap,
  User,
} from "lucide-react";
import { DEFAULT_DETAIL_TABS } from "@mms/shared";

export const ICON_MAP: Record<string, LucideIcon> = {
  // tab keys
  overview: LayoutDashboard,
  timeline: History,
  files: FileText,
  // field keys — gender icon resolved per-value via getGenderIcon in FieldGroupCard
  dob: Calendar,
  // activity types
  note: FileText,
  stage_change: Zap,
  system: User,
  sms: MessageSquare,
  whatsapp: MessageCircle,
  call: Phone,
};

export const DETAIL_SYSTEM_TAB_KEYS = new Set(DEFAULT_DETAIL_TABS.map((tab) => tab.key));
export const DEFAULT_DETAIL_TAB_BY_KEY = new Map(DEFAULT_DETAIL_TABS.map((tab) => [tab.key, tab]));

export const DETAIL_STYLES = {
  networkHeader: "bg-success/10 border-success/30",
  networkIcon: "bg-success/10 text-success",
  networkTitle: "text-success",
  networkSubtitle: "text-success/80",
  networkItemCard: "border-border hover:border-success/30 hover:bg-success/5",
  networkItemIcon: "bg-success/10 text-success border border-success/20",
  networkItemAction: "hover:bg-muted text-muted-foreground hover:text-foreground",
  networkRelType: "text-success",
  liveIntelIndicator: "bg-success",
  liveIntelText: "text-success",
} as const;

export const COLLECTION_CONTAINER_CLASS = "divide-y divide-border/50";

export function isEmptyValue(val: unknown): boolean {
  if (val === undefined || val === null || val === "") return true;
  if (Array.isArray(val) && val.length === 0) return true;
  return false;
}
